import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * The project's central claim is "bad content fails the build rather than
 * rendering wrong". These tests are the only ones that actually exercise
 * that claim end to end: they corrupt a real data file, run the real build
 * (`npm run build`, exactly as CI and Cloudflare do) as a child process, and
 * assert it fails loudly. Every other unit test only checks the validator
 * functions in isolation — none of them prove the build itself rejects bad
 * content.
 *
 * Each case runs a full `astro check && astro build`, so this file is slow
 * (tens of seconds total). It still lives in tests/unit/ so `npm test` — and
 * therefore CI — runs it; nothing here is skipped or gated behind a manual
 * flag. If that turns out to be too slow for local iteration, split it into
 * its own vitest project/script, but as delivered it runs with the rest of
 * the suite.
 */

const ROOT = process.cwd();
const BUILD_TIMEOUT_MS = 120_000;

interface BuildResult {
  status: number;
  output: string;
}

function runBuild(): BuildResult {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf-8',
    // Cloudflare and CI build in UTC; matching that here is what makes the
    // offset-less-date case actually fail instead of merely being wrong.
    env: { ...process.env, TZ: 'UTC' },
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  };
}

/** Reads a data file, hands its text to `mutate`, restores the original in finally. */
function withMutatedFile(relativePath: string, mutate: (original: string) => string, run: () => void): void {
  const path = join(ROOT, relativePath);
  const original = readFileSync(path, 'utf-8');
  const mutated = mutate(original);
  if (mutated === original) {
    throw new Error(`Test bug: mutate() for ${relativePath} did not change anything.`);
  }
  try {
    writeFileSync(path, mutated);
    run();
  } finally {
    // Always restore, even if the build hung, crashed unexpectedly, or an
    // assertion above threw — the repo must never end this test with a
    // corrupted data file.
    writeFileSync(path, original);
  }
}

describe('the real build rejects bad content', () => {
  it(
    'fails a fixture date with no UTC offset',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        (text) => text.replace('date: 2026-08-02T20:45:00+08:00', 'date: 2026-08-02T20:45:00'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/explicit UTC offset/);
          expect(output).toMatch(/2026-08-02-jdt-h/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a duplicate id in standings.yaml',
    () => {
      withMutatedFile(
        'src/data/standings.yaml',
        (text) =>
          `${text}- id: jdt\n  team: jdt\n  won: 1\n  drawn: 1\n  lost: 4\n  goalsFor: 4\n  goalsAgainst: 15\n`,
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/Duplicate ids/);
          expect(output).toMatch(/standings\.yaml/);
          expect(output).toMatch(/"jdt" appears 2 times/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a finished fixture with no score',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        (text) => text.replace('  away: jdt\n  status: scheduled', '  away: jdt\n  status: finished'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/finished match requires a score/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a news article date with a time component',
    () => {
      withMutatedFile(
        'src/content/news/kedah-edge-selangor.md',
        (text) => text.replace('date: 2026-07-19', 'date: 2026-07-19T23:30:00'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/must be a plain date with no time component/);
          expect(output).toMatch(/date/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a fixture referencing a team slug that does not exist',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        (text) => text.replace('  away: jdt\n  status: scheduled', '  away: not-a-real-team\n  status: scheduled'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/unknown teams entries/);
          expect(output).toMatch(/not-a-real-team/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );
});
