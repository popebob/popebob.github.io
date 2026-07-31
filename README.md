# popebob.github.io

Visual companion site for my job search — a designed, human-only presentation of my career at
**[popebob.github.io](https://popebob.github.io/)**. It complements (does not replace) my
ATS-facing CV; the canonical document is the PDF the site links to.

## How it works

```
content/career.yml          ← single source of content (edit this)
templates/index.html.j2     ← Jinja2 page template
assets/                     ← CSS, JS, self-hosted IBM Plex fonts, favicon, CV PDF
build.py                    ← renders content + template → dist/
.github/workflows/deploy.yml← builds and deploys to GitHub Pages on every push to main
```

The page ships three switchable visual themes (Dossier / Editorial / Ops) — a toggle in the
masthead, persisted in `localStorage`, deep-linkable with `?theme=editorial` etc. Plain HTML
and CSS, no frameworks, no trackers.

## Updating when the CV changes

The CV source of truth lives in a separate private repo. When it changes:

1. Update the affected facts in `content/career.yml`.
2. Replace `assets/cody-adams-cv.pdf` with the newly built CV PDF.
3. Push to `main` — the workflow rebuilds and redeploys the site automatically.

Every fact in `content/career.yml` must trace back to the verified fact sheet in the private
CV repo. Never add a tool, metric, or number that isn't verified there.

## Local preview

```sh
python3 -m venv .venv && .venv/bin/pip install pyyaml jinja2
.venv/bin/python build.py
python3 -m http.server -d dist 8000   # http://localhost:8000
```

GitHub Pages must be set to build from **GitHub Actions** (Settings → Pages → Source) for
deploys to work; pull requests run the build as a check without deploying.
