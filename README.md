# Kedah FA Website

Official club website. Static site built with Astro, deployed to Cloudflare Pages.

## Requirements

Node 22.12 or later.

## Commands

```bash
npm install       # install dependencies
npm run dev       # local dev server at http://localhost:4321
npm run build     # type check and build to dist/
npm run preview   # serve the built site
npm test          # unit tests
npm run test:e2e  # end-to-end and accessibility tests
```

## Updating content

All content lives in the repository. Edit, commit, push — Cloudflare rebuilds
and deploys automatically.

| To update | Edit |
|---|---|
| A match result | `src/data/fixtures.yaml` — set `status: finished` and add `score` |
| The league table | `src/data/standings.yaml` — only W/D/L and goals; points are calculated |
| The squad | `src/data/squad.yaml` |
| Sponsors | `src/data/sponsors.yaml` |
| Club details | `src/data/club.yaml` |
| A news article | Add a Markdown file to `src/content/news/` |
| Homepage slider | `src/data/slides.yaml` |

The build validates everything. If a fixture is missing a score, a team slug is
misspelled, or an image path does not exist, the build fails with a named error
and the live site is left untouched.

### Homepage slider

`src/data/slides.yaml` drives the full-width slider at the top of the homepage.
Each entry needs `id`, `image`, `imageAlt` and `title`; `eyebrow`, `href`, `cta`
and `order` are optional. `cta` only works together with `href`.

Slides run in `order` ascending, and any slide without an `order` falls after
those that have one. Put photography in `public/images/slides/` — the build
fails if `image` points at a file that is not there, so a typo cannot ship.

The component renders images at 1600×900 and darkens the bottom third to keep
the headline readable, so pick photography with a dark lower third — a bright
sky or a pale crowd sitting where the text lands will wash it out.

## Rebranding

All colours and fonts live in `src/styles/tokens.css`. The current palette is a
placeholder, not official club branding.

## Deployment

Cloudflare Pages, building from `main`:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`

Because the site is static, "next match" is fixed at build time. A daily
scheduled deploy is configured so the homepage advances past a played fixture
even if nobody commits.
