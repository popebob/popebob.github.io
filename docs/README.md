# How this site works

The repo's root [README.md](../README.md) is a **verbatim copy of my master CV markdown**
(source of truth lives in a separate private repo). GitHub renders it as the repo preview,
and the site at [popebob.github.io](https://popebob.github.io/) is built from it.

```
README.md                   ← the CV (verbatim copy — the primary content source)
content/curation.yml        ← editorial overlay: case studies, stat strip, intros,
                              timeline badge/highlight polish, compliance grouping
templates/index.html.j2     ← Jinja2 page template
assets/                     ← CSS, JS, self-hosted IBM Plex fonts, favicon, CV PDF
build.py                    ← parses README.md + merges curation.yml → dist/
sync.sh                     ← copies the latest CV .md/.pdf from ../resume into place
.github/workflows/deploy.yml← builds and deploys to GitHub Pages on every push to main
```

`build.py` parses the CV for identity/contact, the summary, every Core Skills category
(→ capability cards), the full experience history (→ career timeline, including
promoted-from annotations and date spans), and certifications/education. Parsing is
strict: if the CV's structure changes in a way the parser can't read, CI fails rather
than deploying a broken page. New roles added to the CV appear on the timeline
automatically, using the role's first bullet until a curated highlight is added in
`content/curation.yml`.

## Updating when the CV changes

```sh
./sync.sh        # copies ../resume/cody-adams-*.md → README.md and the PDF → assets/
git diff         # review
git commit -am "CV refresh" && git push   # CI rebuilds and redeploys the site
```

Every fact in `content/curation.yml` must trace to the master CV or the verified fact
sheet in the private resume repo. Never add a tool, metric, or number that isn't there.

## Local preview

```sh
python3 -m venv .venv && .venv/bin/pip install pyyaml jinja2
.venv/bin/python build.py
python3 -m http.server -d dist 8000   # http://localhost:8000
```

The page ships three switchable themes (Dossier / Editorial / Ops) — the centered
"Page style" control, persisted in `localStorage`, deep-linkable via `?theme=`.
GitHub Pages is set to build from GitHub Actions; PRs run the build as a check
without deploying.
