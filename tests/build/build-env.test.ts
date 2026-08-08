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
  // Captured here but not yet asserted on by this file — Task 4 covers it.
  // Left in Snapshot rather than dropped so that task's cases read straight
  // off the same two builds instead of adding a third.
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

  // Read immediately, inside this call, rather than lazily from a shared
  // `dist/`. The two builds in beforeAll write into the same directory, so a
  // helper that reads dist/ at assertion time would only ever see whichever
  // build ran last — silently blind to a staging-only regression.
  const cnamePath = join(ROOT, 'dist', 'CNAME');
  const robotsTxtPath = join(ROOT, 'dist', 'robots.txt');
  return {
    indexHtml: readFileSync(join(ROOT, 'dist', 'index.html'), 'utf-8'),
    cname: existsSync(cnamePath) ? readFileSync(cnamePath, 'utf-8').trim() : null,
    // '' when the build emits no robots.txt, so the assertion always runs
    // instead of the case early-returning.
    robotsTxt: existsSync(robotsTxtPath) ? readFileSync(robotsTxtPath, 'utf-8') : '',
  };
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

  // The mistake this guards: adding robots.txt with `Disallow: /` alongside
  // the meta tag — most likely by making src/pages/robots.txt.ts conditional
  // on isStaging(), the same way BaseLayout.astro was just made conditional.
  // Disallow stops the crawl that would deliver the noindex, so the two
  // cancel out and the URL can still be indexed as a bare entry.
  //
  // Checked on both builds' own captured snapshots (not a shared dist/ read),
  // since either one could regress independently, and robotsTxt is '' rather
  // than absent-and-skipped so each assertion always runs.
  it('ships no robots.txt that would block the crawl the noindex depends on', () => {
    expect(staging.robotsTxt).not.toMatch(/Disallow:\s*\/\s*$/m);
    expect(production.robotsTxt).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
