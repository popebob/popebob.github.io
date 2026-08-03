# popebob.github.io — working notes for Claude

Public GitHub Pages site at **https://popebob.github.io/** — a designed, human-facing
companion to Cody's CV (not a replacement for the ATS document). Repo:
`https://github.com/popebob/popebob.github.io`.

## Always hand back GitHub links after pushing

**Whenever code is pushed, report the GitHub links — never just say "pushed" or "merged."**
Cody wants to click straight through to the work. Include, every time and as real URLs:

| What | URL shape |
|---|---|
| Feature branch | `https://github.com/popebob/popebob.github.io/tree/<branch>` |
| Pull request | `https://github.com/popebob/popebob.github.io/pull/<n>` |
| Pipeline run | `https://github.com/popebob/popebob.github.io/actions/runs/<run-id>` |
| Commit | `https://github.com/popebob/popebob.github.io/commit/<sha>` |
| Live site | `https://popebob.github.io/` (add `?theme=ops` / `?theme=editorial` when a change is theme-specific) |

Rules of thumb:

- Report links **as soon as they exist** — the branch and PR URL right after `git push` /
  `gh pr create`, not only at the end of the task.
- Include the **pipeline run link whether CI passed or failed**. On failure the run link is
  the most useful thing in the message, so lead with it.
- After a merge, give the **deploy run** link plus the live URL, and say what was verified
  against the live page.
- Grab the URLs from the tooling rather than hand-assembling them:
  - `gh pr create` prints the PR URL; `gh pr view <n> --json url -q .url`
  - `gh run list --branch main --limit 1 --json url,displayTitle,status,conclusion`
  - `gh run view <run-id> --json url -q .url`
- Applies to the sibling private resume repo too (`TheVatican/resume`) for anything pushed
  there — branch/commit links, even though it has no CI.

## Content flow (README is the CV)

```
README.md                ← VERBATIM copy of the master CV markdown (the repo's GitHub preview)
content/curation.yml     ← editorial overlay only: case studies, stat strip, intros,
                           timeline badge/highlight polish, compliance grouping
templates/index.html.j2  ← Jinja2 template
assets/                  ← CSS, JS, self-hosted IBM Plex, favicon, cody-adams-cv.pdf
build.py                 ← parses README.md + merges curation.yml → dist/
sync.sh                  ← copies newest CV .md/.pdf from ../resume into place
```

`build.py` parses the CV for identity/contact, summary, Core Skills groups, the full
experience history (timeline), and credentials. Parsing is **strict on purpose**: structural
drift fails CI rather than deploying a broken page. The contact block is the most drift-prone
part — it may be split across lines with markdown hard breaks and may carry extra entries
(e.g. `popebob.github.io`). Preserve `parse_header()`'s loud-failure behavior; never let it
emit a half-built URL.

Update flow: `./sync.sh` → `git diff` → commit → push to `main` → Actions rebuilds and
deploys. New CV roles appear on the timeline automatically (first-bullet fallback until a
curated highlight is added).

## Facts discipline

Every fact on this site must trace to the master CV or the **Verified facts** section of
`../resume/CLAUDE.md`. **Never invent a tool, metric, or number.** Nothing from the
per-company cover letters belongs here — those are per-application and stay private.

## Themes (three, deliberately divergent)

- **dossier** (default) — navy/paper/copper, material depth, case cards scroll as a sticky 3D deck.
- **editorial** — broadsheet: centered serif nameplate, serif body, drop caps, ledger timeline;
  deliberately **flat** (no stack, no tilt, no shadows). Keep it that way.
- **ops** — console: terminal chrome + Elastic-style query bar, cases as one continuous log
  buffer that prints **line-by-line** as it crosses a reveal line at 62% of the viewport
  (`streamLog()` in `assets/js/site.js`; `LINE_MS` controls pace).

Asset links carry a content-hash `?v=` cache-buster computed in `build.py` — keep it when
touching the template's CSS/JS tags, or deploys stop reaching browsers.

## Verifying visual changes

- Contrast: check text/background token pairs against WCAG AA before shipping a palette change.
- **Screenshots of scrolled state**: `--screenshot` with `--virtual-time-budget` does **not**
  capture post-scroll/post-timeout state (and smooth-scroll never runs under virtual time) —
  it silently returns blank or top-of-page frames. Drive Chrome over CDP instead:
  `--remote-debugging-port=9333 --remote-allow-origins='*'`, wait for `/json/version`, then
  `Runtime.evaluate` a `scrollTo({behavior:'instant'})` and `Page.captureScreenshot`.
- Chrome headless on macOS clamps window width to ~500px, so a `--window-size=390` "mobile"
  shot renders a 500px layout cropped — that is not real overflow.

## Housekeeping

- Never `git add -A` without checking the result — a `__pycache__/*.pyc` got committed that
  way once. `dist/`, `.venv/`, `__pycache__/`, `*.pyc` are gitignored.
- Delete feature branches after merge (local and remote).
- Pages is set to build from **GitHub Actions**; PRs run the build as a check without deploying.
