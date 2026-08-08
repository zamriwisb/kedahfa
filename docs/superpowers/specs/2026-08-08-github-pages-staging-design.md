# GitHub Pages staging deploy on kedahfa.dev-aplikasiniaga.com

Date: 2026-08-08

## Goal

Publish the built site to GitHub Pages at
`https://kedahfa.dev-aplikasiniaga.com` on every push to `main`, as a
**staging site for review and sign-off**. `https://kedahfa.com` remains the
intended production home and is not served by this deployment.

The staging site must not compete with the eventual production site in search
results.

## Decisions

### The site URL is environment-driven, production is the default

`astro.config.mjs` becomes:

```js
site: process.env.SITE_URL ?? 'https://kedahfa.com',
```

The default is unchanged, so a local `npm run build` and the existing CI job
keep producing exactly the URLs they produce today. The deploy workflow sets
`SITE_URL=https://kedahfa.dev-aplikasiniaga.com`.

`Astro.site` feeds four things: the `<link rel="canonical">` and `og:url` in
`BaseLayout.astro`, absolute `og:image` URLs, `sitemap-index.xml` from
`@astrojs/sitemap`, and `rss.xml`. Leaving `site` pinned to `kedahfa.com` while
serving from the staging host would make every one of those emit a URL that
does not resolve — a reviewer clicking an item in the RSS feed would land on a
dead domain. Pointing `site` at the host actually being served keeps the
generated URLs honest.

### Staging is de-indexed with a meta tag, and deliberately has no blocking robots.txt

`BaseLayout.astro` emits, on staging builds only:

```html
<meta name="robots" content="noindex, nofollow" />
```

The site already serves a `robots.txt` from the generated route
`src/pages/robots.txt.ts`, which emits `Allow: /` plus a `Sitemap:` line and is
environment-independent. That stays exactly as it is. What must never be added
is a `Disallow: /`, and the reason is worth stating because the instinct runs
the other way.

`Disallow` stops a crawler from **fetching** the page, which means it never
reads the `noindex` tag. A URL that is disallowed but linked from somewhere
else can still be indexed as a bare entry with no title or description, and
because the crawler is forbidden from fetching it, the de-indexing request can
never be delivered. "Do not crawl this" and "do not index this" are
contradictory instructions and only the second one expresses the actual intent.
So the staging site invites crawling and answers with `noindex`.

`nofollow` is included alongside `noindex` so crawlers do not treat staging as
a source of inbound links to the pages it references.

### The staging flag lives in `src/lib/site.ts`

```ts
export function isStaging(): boolean {
  return process.env.SITE_ENV === 'staging';
}
```

One named export rather than an inline `process.env` read in the layout: it
gives the flag a single definition, a place for the comment explaining why it
exists, and something a unit test can import directly.

A function rather than a `const`: a const captures `process.env` once at module
load, so testing both branches would need `vi.resetModules()` and a dynamic
re-import for every case. A function reads the variable when called, which
makes the test a plain assignment and assertion.

`process.env` rather than `import.meta.env`: this module is imported only from
`BaseLayout.astro`'s frontmatter, which for `output: 'static'` runs in Node at
build time and never ships to the browser. The build test below is what proves
the read actually works end to end rather than silently evaluating to
`undefined`.

The deploy workflow sets `SITE_ENV=staging` next to `SITE_URL`. The two are
separate variables on purpose — a URL is not a claim about indexing policy, and
a future production Pages deploy will want the first without the second.

### `public/CNAME` binds the custom domain

A `public/CNAME` file containing the single line:

```
kedahfa.dev-aplikasiniaga.com
```

Astro copies `public/` verbatim into `dist/`, and GitHub Pages reads
`CNAME` from the published artifact to bind the custom domain. Holding it in
the repo rather than only in the repository Settings UI means the binding is
version-controlled and survives a Settings reset or a re-created Pages site.

No `base` path is needed: a custom domain serves from the root, unlike a
`user.github.io/repo` deployment.

### Deploy runs independently of CI

`.github/workflows/deploy.yml`, triggered on push to `main`. It does not wait
for `ci.yml` and `ci.yml` is left exactly as it is — it keeps running on pushes
and pull requests as it does today.

The accepted trade-off: a commit can deploy to staging while its own test run
is red. The gap is narrower than it first appears, because the deploy job runs
`npm run build`, and that script is `astro check && astro build`. A type error,
a content-collection schema violation, or any of the build-time reference and
asset assertions still fail the deploy on its own build step. What can reach
staging is a commit that builds cleanly but fails a unit, build-negative, or
e2e test.

A `concurrency` group with `cancel-in-progress: false` keeps two rapid pushes
from racing to publish, without cancelling a deploy that is already uploading.

## Components

| File                             | Change                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `astro.config.mjs`               | `site` reads `SITE_URL`, defaults to production            |
| `src/lib/site.ts`                | New. Exports `isStaging`                                   |
| `src/layouts/BaseLayout.astro`   | Conditional `<meta name="robots">`                         |
| `public/CNAME`                   | New. The staging hostname                                  |
| `.github/workflows/deploy.yml`   | New. Build with staging env, publish to Pages              |
| `tests/unit/site.test.ts`        | New. Covers the flag                                       |
| `tests/build/build-env.test.ts`   | New. Staging build emits noindex, default does not          |
| `.github/workflows/ci.yml`       | Untouched                                                  |

## Workflow shape

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false
```

Three steps beyond checkout and `npm ci`: `actions/configure-pages`, a build
step carrying `SITE_URL` and `SITE_ENV`, `actions/upload-pages-artifact` on
`./dist`, then `actions/deploy-pages` in a dependent job with the
`github-pages` environment.

`workflow_dispatch` is included so a deploy can be re-run without an empty
commit — useful when only DNS or Pages settings changed.

## Testing

Two additions, matching how the project already tests:

1. **`tests/unit/site.test.ts`** — `isStaging` is true only for the exact
   string `staging`, and false when the variable is unset. Guards against the
   flag being accidentally truthy for any non-empty value.

2. **`tests/build/build-env.test.ts`** — a new file rather than a case inside
   `build-negative.test.ts`, which exists specifically to prove bad content
   *fails* the build. This asserts what a good build *emits*, so it does not
   belong there. It spawns a real build with `SITE_ENV=staging` and
   asserts the emitted HTML contains the `noindex` meta tag, then a default
   build and asserts it does not. This is the only check that proves the guard
   works end to end, including that `process.env` is readable from layout
   frontmatter. Testing the flag alone would pass even if the layout never
   consumed it.

The existing e2e suite is unaffected: it runs against a default-env
`astro preview`, where neither the URL nor the robots tag changes.

## Manual steps outside this repo

These cannot be done from the codebase and must be done for the deploy to
resolve:

1. **DNS** — a `CNAME` record for host `kedahfa` in the
   `dev-aplikasiniaga.com` zone, pointing to `zamriwisb.github.io`. A subdomain
   takes a `CNAME`; only an apex domain would need `A` records.
2. **Repository Settings → Pages → Source** — set to **GitHub Actions**. The
   default is "Deploy from a branch" and the workflow cannot publish until this
   is changed.
3. **Enforce HTTPS** — tick it once GitHub finishes provisioning the
   certificate. Provisioning starts after DNS resolves and can take up to
   roughly an hour; the checkbox is disabled until it completes.

The repository is public, so Pages is available on the free plan. No action
needed there.

## Out of scope

- A production deploy to `kedahfa.com`. When that happens it is a second
  workflow (or an environment on this one) with `SITE_ENV` unset, plus its own
  DNS. The env-driven `site` is what keeps that a configuration change rather
  than a code change.
- Basic-auth or IP restriction on staging. GitHub Pages cannot set response
  headers or gate access on a public repo; `noindex` keeps it out of search
  results but the URL is reachable by anyone who has it. Flagged as a known
  property of this hosting choice, not a defect to fix here.
- Preview deploys per pull request.
