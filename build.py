#!/usr/bin/env python3
"""Render the site: README.md (CV copy) + content/curation.yml + template -> dist/.

README.md is a verbatim copy of the master CV markdown from the sibling resume
repo (refresh it with ./sync.sh). Everything derivable comes from it: identity,
contact, summary, skill categories, the experience timeline (with promoted-from
annotations and date spans), and credentials. content/curation.yml carries only
the editorial layer a flat CV can't express: case studies, stat strip, section
intros, timeline badge/highlight overrides, and compliance grouping.

Parsing is strict: if the CV's structure changes in a way this parser can't
read, the build fails loudly (CI goes red) rather than deploying a broken page.
"""

import hashlib
import re
import shutil
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).resolve().parent


class ParseError(Exception):
    pass


def clean_md(s):
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    return s.strip()


def smart_split(s):
    """Split on commas that are not inside parentheses."""
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def sections_of(md):
    md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
    out = []
    for chunk in re.split(r"(?m)^## ", md)[1:]:
        head, _, body = chunk.partition("\n")
        out.append((head.strip(), body))
    return out


def find_section(sections, prefix):
    for head, body in sections:
        if head.lower().startswith(prefix.lower()):
            return body
    raise ParseError(f"section '{prefix}' not found in README.md")


def years_span(*date_strs):
    ys, present = [], False
    for d in date_strs:
        ys += [int(y) for y in re.findall(r"\b(?:19|20)\d{2}\b", d)]
        if re.search(r"present", d, re.I):
            present = True
    if not ys:
        raise ParseError(f"no years found in dates: {date_strs}")
    start = min(ys)
    end = "present" if present else max(ys)
    return start, f"{start} – {end}"


def first_bullet(text):
    m = re.search(r"(?m)^- (.+)$", text)
    return clean_md(m.group(1)) if m else ""


def base_title(s):
    """Trim a ' – Suffix' qualifier from a role title."""
    return re.split(r"\s+[–—]\s+", s)[0].strip()


def parse_header(name, body):
    """Read the tagline and contact block.

    The contact block may be split across lines with markdown hard breaks
    (a trailing backslash or two spaces), so continuation lines are joined
    before parsing — a split block must not silently drop a field.
    """
    lines = [l.strip() for l in body.splitlines()]
    tagline = None
    contact_parts = []
    collecting = False
    for line in lines:
        if tagline is None and re.fullmatch(r"\*\*(.+)\*\*", line):
            tagline = clean_md(line)
            continue
        hard_break = line.endswith("\\")
        stripped = line.rstrip("\\").strip()
        if not collecting and "|" in stripped and "@" in stripped:
            collecting = True
            contact_parts.append(stripped)
        elif collecting and stripped and "|" in stripped:
            contact_parts.append(stripped)
        elif collecting and not hard_break:
            break
        if collecting and not hard_break and contact_parts:
            break
    if not tagline or not contact_parts:
        raise ParseError("header tagline or contact line not found")
    parts = [p.strip() for p in " | ".join(contact_parts).split("|") if p.strip()]
    email = next((p for p in parts if "@" in p), None)
    phone = next((p for p in parts if re.search(r"\d{3}[-.]\d{4}", p)), "")
    linkedin = next((p for p in parts if "linkedin" in p.lower()), "")
    location = next(
        (p for p in parts if p not in (email, phone, linkedin) and "." not in p), ""
    )
    if not email:
        raise ParseError("email not found in contact line")
    if not linkedin:
        raise ParseError(
            "LinkedIn URL not found in contact block — "
            f"parsed fields: {parts}"
        )
    url = linkedin if linkedin.startswith("http") else "https://www." + linkedin
    return dict(
        name=name, tagline=tagline, email=email, phone=phone,
        linkedin=url, linkedin_label=re.sub(r"^https?://(www\.)?", "", url),
        location=location,
    )


def parse_skills(body):
    caps, langs = [], []
    for m in re.finditer(r"(?m)^- \*\*(.+?):\*\*\s*(.+)$", body):
        cat, items = m.group(1).strip(), smart_split(m.group(2))
        if cat.lower().startswith("languages"):
            langs = items
        else:
            caps.append(dict(name=cat, chips=items))
    if not caps or not langs:
        raise ParseError("Core Skills bullets (or Languages) not parsed")
    return caps, langs


def parse_role_block(head, rest):
    subroles = re.findall(r"(?m)^\*\*(.+?)\*\*\s*\|\s*(.+)$", rest)
    if subroles and "—" in head:
        # Company-level block with nested dated roles (e.g. Ford)
        company, _, loc = head.partition("—")
        location = re.sub(r"\s*\(.*?\)\s*$", "", loc).strip()
        ordered = sorted(subroles, key=lambda t: years_span(t[1])[0])
        start, years = years_span(*[t[1] for t in subroles])
        para = rest.strip().split("\n\n")[0]
        fallback = clean_md(para) if not para.lstrip().startswith(("**", "-")) else first_bullet(rest)
        return dict(
            company=clean_md(company), location=location,
            roles=" → ".join(base_title(t[0]) for t in ordered),
            badge="", start=start, years=years, fallback=fallback,
        )
    title = head
    promoted = re.search(r"\*\((?:promoted|expanded) from (.+?)\)\*", title)
    title_clean = clean_md(re.sub(r"\*\(.*?\)\*", "", title))
    m = re.search(r"(?m)^\*\*(.+?)\*\*\s*—\s*(.+)$", rest)
    if not m:
        raise ParseError(f"company line not found under role '{head}'")
    # Segments after the dash: [role, ] location | dates — a role segment
    # appears when the heading is a grouping like "Earlier Career".
    segs = [p.strip() for p in m.group(2).split("|")]
    if len(segs) < 2:
        raise ParseError(f"company line under '{head}' lacks '| dates' segment")
    dates, location = segs[-1], segs[-2]
    line_role = " / ".join(segs[:-2]) if len(segs) > 2 else ""
    start, years = years_span(dates)
    if line_role:
        roles, badge = line_role, ""
    elif promoted:
        roles, badge = f"{promoted.group(1)} → {title_clean}", "Promoted"
    else:
        roles, badge = title_clean, ""
    return dict(
        company=clean_md(m.group(1)), location=location,
        roles=roles, badge=badge,
        start=start, years=years, fallback=first_bullet(rest),
    )


def parse_experience(body):
    entries = []
    for block in re.split(r"(?m)^### ", body)[1:]:
        head, _, rest = block.partition("\n")
        entries.append(parse_role_block(head.strip(), rest))
    if not entries:
        raise ParseError("no experience entries parsed")
    return sorted(entries, key=lambda e: e["start"])


def parse_credentials(body):
    m = re.search(
        r"\*\*Certifications:\*\*\s*(.+?)\s*\*\*Education:\*\*\s*(.+)", body, re.S
    )
    if not m:
        raise ParseError("Certifications/Education line not parsed")
    certs = " · ".join(
        p.strip() for p in clean_md(m.group(1)).rstrip(". ").split("|")
    )
    return dict(certifications=certs, education=clean_md(m.group(2)))


def parse_readme(md):
    sections = sections_of(md)
    if not sections:
        raise ParseError("no '## ' sections found in README.md")
    header = parse_header(*sections[0])
    summary = " ".join(find_section(sections, "Summary").split())
    caps, langs = parse_skills(find_section(sections, "Core Skills"))
    experience = parse_experience(find_section(sections, "Professional Experience"))
    credentials = parse_credentials(find_section(sections, "Certifications"))
    return header, summary, caps, langs, experience, credentials


def overlay_for(company, overrides):
    key = norm(company)
    for o in overrides:
        k = norm(o.get("company", ""))
        if k and (k.startswith(key) or key.startswith(k)):
            return o
    return {}


def main() -> None:
    cur = yaml.safe_load((ROOT / "content" / "curation.yml").read_text())
    header, summary, caps, langs, experience, credentials = parse_readme(
        (ROOT / "README.md").read_text()
    )

    leads = cur.get("capability_leads", {})
    for cap in caps:
        for cat, lead in leads.items():
            if norm(cat) == norm(cap["name"]):
                cap["lead"] = lead

    overrides = cur.get("timeline", {}).get("overrides", [])
    entries = [
        dict(
            years=e["years"], company=e["company"], location=e["location"],
            roles=overlay_for(e["company"], overrides).get("roles", e["roles"]),
            badge=overlay_for(e["company"], overrides).get("badge", e["badge"]),
            highlight=overlay_for(e["company"], overrides).get("highlight", e["fallback"]),
        )
        for e in experience
    ]

    asset_v = hashlib.sha1(
        (ROOT / "assets" / "css" / "site.css").read_bytes()
        + (ROOT / "assets" / "js" / "site.js").read_bytes()
    ).hexdigest()[:10]

    profile = dict(header, summary=summary, **cur["profile_extras"])
    context = dict(
        asset_v=asset_v,
        meta=cur["meta"],
        profile=profile,
        stats=cur["stats"],
        case_studies_intro=cur["case_studies_intro"],
        case_studies=cur["case_studies"],
        timeline=dict(
            headline=cur["timeline"]["headline"],
            intro=cur["timeline"]["intro"],
            entries=entries,
        ),
        capabilities_intro=cur["capabilities_intro"],
        capabilities=caps,
        languages=langs,
        compliance=cur["compliance"],
        credentials=credentials,
        colophon=cur["colophon"],
    )

    env = Environment(
        loader=FileSystemLoader(ROOT / "templates"),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    html = env.get_template("index.html.j2").render(**context)

    dist = ROOT / "dist"
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    (dist / "index.html").write_text(html)
    shutil.copytree(ROOT / "assets", dist / "assets")
    print(f"built dist/index.html ({len(html):,} bytes) + assets/")
    print(f"  parsed: {len(entries)} roles, {len(caps)} skill groups, "
          f"{len(langs)} languages")


if __name__ == "__main__":
    main()
