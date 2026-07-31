#!/usr/bin/env python3
"""Render the site: content/site.yml + templates/index.html.j2 -> dist/.

Zero-config: `pip install pyyaml jinja2`, then `python build.py`.
StrictUndefined makes a missing content key fail the build loudly instead of
rendering a blank spot.
"""

import shutil
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).resolve().parent


def main() -> None:
    content = yaml.safe_load((ROOT / "content" / "career.yml").read_text())

    env = Environment(
        loader=FileSystemLoader(ROOT / "templates"),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    html = env.get_template("index.html.j2").render(**content)

    dist = ROOT / "dist"
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir()
    (dist / "index.html").write_text(html)
    shutil.copytree(ROOT / "assets", dist / "assets")
    print(f"built dist/index.html ({len(html):,} bytes) + assets/")


if __name__ == "__main__":
    main()
