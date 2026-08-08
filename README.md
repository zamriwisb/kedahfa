# Kedah FA Website

Official club website. Static site built with Astro, deployed to GitHub Pages.

## Requirements

Node 22.12 or later.

## Commands

```bash
npm install       # install dependencies
npm run dev       # local dev server at http://localhost:4321
npm run build     # type check and build to dist/
npm run preview   # serve the built site
npm test          # unit tests (fast — run these on every edit)
npm run test:build # asserts the real build rejects bad content (slow)
npm run test:e2e  # end-to-end and accessibility tests
```

`npm run test:build` spawns a real `npm run build` per case, so it takes far
longer than the rest. Run it before pushing anything that touches
`src/content.config.ts`, `src/lib/validate.ts`, or the shape of `src/data/*`.
CI runs it on every push regardless.

`npm run test:e2e` is **not** run by CI — it is yours to run locally. It covers
navigation, the sliders, the footer and axe accessibility, so run it before
pushing anything that touches layout, and always before a production cutover.

## Updating content

All content lives in the repository. Edit, commit, push — GitHub Actions rebuilds
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

GitHub Pages, via `.github/workflows/deploy.yml`, on every push to `main`.
Settings → Pages → Source must be **GitHub Actions**.

The deploy runs independently of CI — it does not wait for the test suite. That
is deliberate, and narrower than it sounds: the job runs `npm run build`, which
is `astro check && astro build`, so a type error or a content-schema violation
still fails the deploy. What can reach the site is a commit that builds cleanly
but fails a test.

### Staging

The site currently deploys as **staging**, at
`https://kedahfa.dev-aplikasiniaga.com`. `https://kedahfa.com` remains the
intended production home and is not served yet.

Two environment variables in the workflow control this:

| Variable | Value | Effect |
|---|---|---|
| `SITE_URL` | `https://kedahfa.dev-aplikasiniaga.com` | Astro's `site` — canonical, `og:url`, sitemap, RSS |
| `SITE_ENV` | `staging` | Adds `<meta name="robots" content="noindex, nofollow">` |

Both default to production behaviour when unset, so a local build and CI emit
exactly what they always did. Going live on `kedahfa.com` is a matter of
changing `SITE_URL` and dropping `SITE_ENV` — plus DNS — not a code change.

The `noindex` is what stops staging competing with the production domain in
search. Note there is deliberately **no** `robots.txt` with `Disallow: /`:
`Disallow` blocks the crawl that would deliver the `noindex`, so the two
directives cancel out and a linked URL can still be indexed as a bare entry
that can never then be withdrawn. `src/pages/robots.txt.ts` emits `Allow: /`
on purpose.

`public/CNAME` binds the custom domain. It ships inside `dist/`, which is what
GitHub Pages reads — the copy at the repository root is only how the Settings
UI records the domain.

Because the site is static, "next match" is fixed at build time. Nothing
currently rebuilds on a schedule, so the homepage will not advance past a
played fixture until someone pushes.
