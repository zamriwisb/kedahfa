# GitHub Pages Staging Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every push to `main` to GitHub Pages at `https://kedahfa.dev-aplikasiniaga.com` as a de-indexed staging site, without touching the existing CI workflow.

**Architecture:** The build learns where it is being served from two environment variables the deploy workflow sets — `SITE_URL` (feeds Astro's `site`, so canonical/`og:url`/sitemap/RSS describe the real host) and `SITE_ENV=staging` (feeds a `noindex` meta tag). Both default to production behaviour when unset, so local builds and CI are unchanged. A committed `public/CNAME` binds the custom domain.

**Tech Stack:** Astro 7 (`output: 'static'`), vitest, GitHub Actions, GitHub Pages.

## Global Constraints

- Node 22 (`engines.node >= 22.12.0`); workflows use `node-version: 22`.
- `.github/workflows/ci.yml` must not be modified. The deploy does not gate on it.
- Staging hostname, exact: `kedahfa.dev-aplikasiniaga.com`
- Production site URL, exact, and the default when `SITE_URL` is unset: `https://kedahfa.com`
- `SITE_ENV` triggers de-indexing on the exact string `staging` only.
- No `robots.txt` with `Disallow: /` may be added. `Disallow` blocks the crawl that delivers `noindex`; the two instructions cancel out. De-indexing is the meta tag alone.
- Tests in `tests/build/` spawn a real `npm run build` and are slow. They run under `npm run test:build`, never `npm test`.
- `vitest.build.config.ts` already sets `fileParallelism: false` and globs `tests/build/**/*.test.ts`, so a new file there is picked up with no config change.

---

### Task 1: The staging flag

**Files:**
- Create: `src/lib/site.ts`
- Test: `tests/unit/site.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isStaging(): boolean` from `src/lib/site.ts`. Task 2 imports it into `BaseLayout.astro`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/site.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { isStaging } from '../../src/lib/site';

const original = process.env.SITE_ENV;

afterEach(() => {
  if (original === undefined) delete process.env.SITE_ENV;
  else process.env.SITE_ENV = original;
});

describe('isStaging', () => {
  it('is true for the exact staging marker', () => {
    process.env.SITE_ENV = 'staging';
    expect(isStaging()).toBe(true);
  });

  it('is false when the variable is unset, which is the production default', () => {
    delete process.env.SITE_ENV;
    expect(isStaging()).toBe(false);
  });

  // The failure that would matter: a truthiness check rather than an equality
  // check would de-index production the moment SITE_ENV held any other value.
  it('is false for any other non-empty value', () => {
    for (const value of ['production', 'prod', 'true', '1', 'Staging']) {
      process.env.SITE_ENV = value;
      expect(isStaging(), `SITE_ENV=${value}`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/site.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/site`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/site.ts`:

```ts
/**
 * True only on the GitHub Pages staging deploy, which sets SITE_ENV=staging.
 *
 * Deliberately separate from SITE_URL. A hostname is not a claim about
 * indexing policy, and a future production Pages deploy will want to set the
 * URL without also asking to be de-indexed.
 *
 * A function rather than a const: a const would capture process.env once at
 * module load, so a test covering both branches would need vi.resetModules()
 * and a dynamic re-import per case.
 *
 * process.env rather than import.meta.env: this is imported only from
 * BaseLayout.astro's frontmatter, which for `output: 'static'` runs in Node at
 * build time and never reaches the browser.
 */
export function isStaging(): boolean {
  return process.env.SITE_ENV === 'staging';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/site.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site.ts tests/unit/site.test.ts
git commit -m "feat: add the staging environment flag"
```

---

### Task 2: The noindex tag, proven by a real build

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (frontmatter around line 26-31; `<head>` around line 44)
- Create: `tests/build/build-env.test.ts`

**Interfaces:**
- Consumes: `isStaging()` from `src/lib/site.ts` (Task 1).
- Produces: `tests/build/build-env.test.ts` with a `buildWith(overrides)` helper returning `{ status, indexHtml, cname }`. Tasks 3 and 4 add assertions to the same two builds rather than spawning their own.

**Why the harness looks like this:** each `npm run build` takes tens of seconds. The file runs exactly two builds in `beforeAll` — one staging, one default — snapshots the files it needs from `dist/`, and every case asserts against those snapshots. Adding a third build per assertion would make this file unusable.

- [ ] **Step 1: Write the failing test**

Create `tests/build/build-env.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Proves what a *good* build emits, which is why this is not a case inside
 * build-negative.test.ts — that file exists to prove bad content fails.
 *
 * The deploy's entire behaviour is carried by two environment variables, and
 * nothing else in the suite would notice if the layout stopped reading them.
 * A unit test on isStaging() passes even if BaseLayout never calls it.
 */

const ROOT = process.cwd();
// Both builds run inside one beforeAll, so the hook needs room for both. The
// individual cases only read snapshots and need no timeout of their own.
const SETUP_TIMEOUT_MS = 240_000;

interface Snapshot {
  indexHtml: string;
  cname: string | null;
  robotsTxt: string;
}

function buildWith(overrides: Record<string, string>): Snapshot {
  const env: NodeJS.ProcessEnv = { ...process.env, TZ: 'UTC' };
  // The default-build case must not inherit a SITE_ENV or SITE_URL that
  // happens to be exported in the developer's shell. Without this the
  // "production build is indexable" assertion would silently assert nothing
  // on the one machine where it mattered.
  delete env.SITE_ENV;
  delete env.SITE_URL;
  Object.assign(env, overrides);

  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf-8',
    env,
  });

  const status = result.status ?? 1;
  if (status !== 0) {
    throw new Error(
      `Build failed (exit ${status}):\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }

  const cnamePath = join(ROOT, 'dist', 'CNAME');
  return {
    indexHtml: readFileSync(join(ROOT, 'dist', 'index.html'), 'utf-8'),
    // Captured here, not asserted until Task 4.
    cname: existsSync(cnamePath) ? readFileSync(cnamePath, 'utf-8').trim() : null,
    robotsTxt: robotsTxt(),
  };
}

/**
 * '' when the build emits no robots.txt, so the assertion always runs.
 *
 * Read per build and stored on the Snapshot rather than read at assertion
 * time: both builds write the same dist/, so a lazy read would only ever see
 * whichever ran last and the staging guard would never inspect staging.
 */
function robotsTxt(): string {
  const path = join(ROOT, 'dist', 'robots.txt');
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

const STAGING_HOST = 'kedahfa.dev-aplikasiniaga.com';

let staging: Snapshot;
let production: Snapshot;

describe('the build responds to its deploy environment', () => {
  beforeAll(() => {
    staging = buildWith({
      SITE_ENV: 'staging',
      SITE_URL: `https://${STAGING_HOST}`,
    });
    production = buildWith({});
  }, SETUP_TIMEOUT_MS);

  it('de-indexes a staging build', () => {
    expect(staging.indexHtml).toMatch(/<meta\s+name="robots"\s+content="noindex, nofollow"\s*\/?>/);
  });

  it('leaves a default build indexable', () => {
    expect(production.indexHtml).not.toMatch(/noindex/);
  });

  // The mistake this guards: making src/pages/robots.txt.ts conditional on
  // isStaging() and emitting `Disallow: /` there, alongside the meta tag.
  // Disallow stops the crawl that would deliver the noindex, so the two cancel
  // out and the URL can still be indexed as a bare entry.
  //
  // Asserts on BOTH snapshots. The regression it guards would be staging-only,
  // and both builds write the same dist/ — so checking a single lazily-read
  // dist/robots.txt would only ever see production, the build that ran last.
  it('ships no robots.txt that would block the crawl the noindex depends on', () => {
    expect(staging.robotsTxt).not.toMatch(/Disallow:\s*\/\s*$/m);
    expect(production.robotsTxt).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: FAIL — "de-indexes a staging build" fails, because no build emits a robots meta tag yet. The other two cases pass vacuously.

- [ ] **Step 3: Write minimal implementation**

In `src/layouts/BaseLayout.astro`, add the import beside the existing ones (after the `loadSiteData` import on line 17):

```astro
import { isStaging } from '../lib/site';
```

Add to the frontmatter, after the `socialImage` line (line 31):

```astro
const staging = isStaging();
```

In `<head>`, immediately after the `<link rel="canonical" ... />` line:

```astro
{/*
  Staging only. The site is served from a review subdomain that must never
  compete with the production domain for the club's own name.

  Note there is deliberately no robots.txt with `Disallow: /` to go with
  this. Disallow stops a crawler fetching the page, so it never reads this
  tag — and a disallowed URL linked from anywhere can still be indexed as a
  bare title-less entry that can then never be withdrawn. Inviting the crawl
  and answering it with noindex is what actually removes the page.
*/}
{staging && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro tests/build/build-env.test.ts
git commit -m "feat: de-index staging builds"
```

---

### Task 3: The site URL follows the host being served

**Files:**
- Modify: `astro.config.mjs` (the `site` line)
- Modify: `tests/build/build-env.test.ts` (add cases to the existing `describe`)

**Interfaces:**
- Consumes: `buildWith`, `staging`, `production`, `STAGING_HOST` from Task 2.
- Produces: nothing new.

**Context:** `Astro.site` feeds four outputs — `<link rel="canonical">` and `og:url` in `BaseLayout.astro:30-31`, absolute `og:image` URLs, `sitemap-index.xml`, and `rss.xml`. Left pinned to `kedahfa.com` while served from staging, every one of them emits a URL that does not resolve.

- [ ] **Step 1: Write the failing test**

Add these two cases inside the existing `describe` block in `tests/build/build-env.test.ts`, after the robots.txt case:

```ts
  it('points canonical and og:url at the host actually being served', () => {
    expect(staging.indexHtml).toMatch(
      new RegExp(`<link rel="canonical" href="https://${STAGING_HOST}/"`),
    );
    expect(staging.indexHtml).toMatch(
      new RegExp(`property="og:url" content="https://${STAGING_HOST}/"`),
    );
  });

  it('falls back to the production domain when SITE_URL is unset', () => {
    expect(production.indexHtml).toMatch(/<link rel="canonical" href="https:\/\/kedahfa\.com\//);
    expect(production.indexHtml).not.toMatch(new RegExp(STAGING_HOST));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: FAIL — "points canonical and og:url at the host actually being served" fails; the staging build still emits `https://kedahfa.com/`.

- [ ] **Step 3: Write minimal implementation**

In `astro.config.mjs`, replace the `site:` line:

```js
  // Defaults to production, so a local build and the CI job keep emitting
  // exactly the URLs they emit today. The Pages deploy sets SITE_URL to the
  // staging host so that canonical, og:url, sitemap-index.xml and rss.xml all
  // describe the host actually being served — otherwise a reviewer clicking a
  // feed item lands on a domain that is not live yet.
  // Falsy, not nullish: `??` would let a set-but-empty SITE_URL= through as
  // site: '', which fails Astro's URL validation and hard-fails the build
  // instead of defaulting here. GitHub Actions substitutes an empty string
  // rather than omitting the variable when an expression names something
  // unconfigured, so that is the realistic shape of the mistake. An empty
  // string is never a valid site URL.
  site: process.env.SITE_URL || 'https://kedahfa.com',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs tests/build/build-env.test.ts
git commit -m "feat: drive the site URL from SITE_URL, defaulting to production"
```

---

### Task 4: The custom domain binding

**Files:**
- Create: `public/CNAME`
- Modify: `tests/build/build-env.test.ts` (add one case)

**Interfaces:**
- Consumes: `staging`, `STAGING_HOST`, and the `cname` field on `Snapshot` — all defined in Task 2, where `cname` is populated but not yet asserted on.
- Produces: nothing new.

**Context:** GitHub Pages reads `CNAME` from the published artifact to bind a custom domain. Astro copies `public/` verbatim into `dist/`. Holding it in the repo rather than only in the Settings UI keeps the binding version-controlled and able to survive a Settings reset.

- [ ] **Step 1: Write the failing test**

Add this case inside the existing `describe` block in `tests/build/build-env.test.ts`:

```ts
  // Pages reads this file out of the published artifact to bind the custom
  // domain. In public/ it is copied verbatim into dist/; anywhere else and the
  // domain silently reverts to zamriwisb.github.io on the next deploy.
  it('publishes the custom domain binding into dist', () => {
    expect(staging.cname).toBe(STAGING_HOST);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: FAIL — `expected null to be 'kedahfa.dev-aplikasiniaga.com'`.

- [ ] **Step 3: Write minimal implementation**

Create `public/CNAME` with exactly one line and a trailing newline:

```
kedahfa.dev-aplikasiniaga.com
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.build.config.ts tests/build/build-env.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add public/CNAME tests/build/build-env.test.ts
git commit -m "feat: bind the staging custom domain via public/CNAME"
```

---

### Task 5: The deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Do NOT modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `SITE_URL` and `SITE_ENV` (Tasks 1-3), `public/CNAME` (Task 4).
- Produces: a `github-pages` environment deployment.

**Context:** This runs independently of `ci.yml` — no `needs:`, no `workflow_run`. The accepted trade-off is that a commit can deploy while its own test run is red. The gap is narrower than it sounds: this job runs `npm run build`, which is `astro check && astro build`, so type errors and content-schema violations still fail the deploy on its own build step.

There is no automated test for a workflow file; it is verified by the run itself in Step 3.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy staging

# Independent of ci.yml on purpose: no `needs`, no `workflow_run`. A commit can
# therefore deploy while its own test run is red — but `npm run build` below is
# `astro check && astro build`, so type errors and content-schema violations
# still fail the deploy on its own build step.
on:
  push:
    branches: [main]
  # Re-run a deploy without an empty commit — needed when only DNS or the Pages
  # settings changed and the artifact itself is fine.
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Queue overlapping pushes rather than cancelling. cancel-in-progress would
# abort a deploy mid-upload and can leave the Pages site on a partial artifact.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - uses: actions/configure-pages@v5

      - name: Build for staging
        env:
          # Feeds astro.config.mjs `site`, so canonical, og:url, the sitemap
          # and the RSS feed all describe the host being served.
          SITE_URL: https://kedahfa.dev-aplikasiniaga.com
          # Feeds src/lib/site.ts, which adds the noindex meta tag. Separate
          # from SITE_URL because a production Pages deploy would want the URL
          # without the de-indexing.
          SITE_ENV: staging
        run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the whole suite is still green locally**

Run:
```bash
npm run build && npm test && npm run test:build
```
Expected: all three exit 0. `npm run test:build` now includes `build-env.test.ts` and takes a few minutes.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy staging to GitHub Pages"
git push
```

- [ ] **Step 4: Confirm the run**

Run: `gh run list --workflow=deploy.yml --limit 1`
Expected: the run appears. It will **fail at the deploy job** until the manual steps below are done — specifically Settings → Pages → Source must be "GitHub Actions", or `actions/deploy-pages` errors with a message about Pages not being enabled. That failure is expected at this point and is not a defect in the workflow.

---

## Manual steps (cannot be done from this repo)

These are the operator's, not the implementer's. The deploy will not resolve until all three are done.

- [ ] **Repository Settings → Pages → Source**: set to **GitHub Actions**. The default is "Deploy from a branch" and `actions/deploy-pages` fails until this is changed. Do this first — it unblocks the workflow run from Task 5.

- [ ] **DNS**: in the `dev-aplikasiniaga.com` zone, add a `CNAME` record with host `kedahfa` pointing to `zamriwisb.github.io`. A subdomain takes a `CNAME`; only an apex domain would need `A` records. Verify with:

  ```bash
  dig +short kedahfa.dev-aplikasiniaga.com
  ```

- [ ] **Enforce HTTPS**: tick the box in Settings → Pages once GitHub has provisioned the certificate. Provisioning begins after DNS resolves and can take up to roughly an hour; the checkbox stays disabled until it completes.

The repository is already public, so Pages is available on the free plan.

## Verification

Once the manual steps are done and a deploy has run green:

```bash
curl -sI https://kedahfa.dev-aplikasiniaga.com/ | head -1
curl -s https://kedahfa.dev-aplikasiniaga.com/ | grep -o '<meta name="robots"[^>]*>'
curl -s https://kedahfa.dev-aplikasiniaga.com/ | grep -o '<link rel="canonical"[^>]*>'
```

Expected: `HTTP/2 200`; a robots meta tag reading `noindex, nofollow`; a canonical pointing at `https://kedahfa.dev-aplikasiniaga.com/`.

## Out of scope

- A production deploy to `kedahfa.com`. That is a second workflow with `SITE_ENV` unset plus its own DNS; the env-driven `site` is what keeps it a configuration change rather than a code change.
- Access control on staging. Pages cannot set response headers or gate access on a public repo, so `noindex` keeps the site out of search results but anyone holding the URL can open it. This is a property of the hosting choice, not a defect to fix here.
- Per-pull-request preview deploys.
