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
 * (tens of seconds total) — which is why it is no longer part of `npm test`.
 * It runs under `npm run test:build` (vitest.build.config.ts), and CI runs
 * that as its own step. Nothing here is skipped or gated behind a manual
 * flag; the split is about local iteration speed, not about running less.
 *
 * The cost of the split is that `npm test` alone no longer proves the build
 * rejects bad content. Run `npm run test:build` before pushing any change to
 * src/content.config.ts, src/lib/validate.ts, or the shape of src/data/*.
 */

const ROOT = process.cwd();
const BUILD_TIMEOUT_MS = 120_000;

/**
 * fixtures.yaml is empty between seasons, so the fixture cases below supply
 * the match they need instead of mutating one that happens to be in the file.
 * That also stops them breaking every time the real schedule changes.
 */
const SCHEDULED_FIXTURE = [
  '- id: 2026-08-02-jdt-ii-h',
  '  competition: A1 Semi-Pro League',
  '  matchweek: 1',
  '  date: 2026-08-02T20:45:00+08:00',
  '  venue: Darul Aman Stadium',
  '  home: kedah',
  '  away: jdt-ii',
  '  status: scheduled',
  '',
].join('\n');

/**
 * Between seasons the file holds a bare `[]` (a comments-only file is not a
 * YAML array, which the loader rejects), and appending block entries after
 * `[]` is invalid YAML — so the marker is swapped for the entry. Once a real
 * schedule is in the file there is no marker and the entry is appended.
 */
function withFixtureEntry(entry: string): (text: string) => string {
  return (text) =>
    /^\[\]\s*$/m.test(text)
      ? text.replace(/^\[\]\s*$/m, entry)
      : // text.replace(/\n*$/, '\n') normalises to exactly one trailing
        // newline before appending, regardless of whether fixtures.yaml ends
        // with one, none, or several: a bare `text + entry` would silently
        // concatenate onto a missing trailing newline and produce invalid
        // YAML, failing these cases on a parse error instead of the guard
        // they name.
        text.replace(/\n*$/, '\n') + entry;
}

/** An away fixture, for the guard that only home matches may sell tickets. */
const AWAY_FIXTURE = [
  '- id: 2026-08-09-jdt-ii-a',
  '  competition: A1 Semi-Pro League',
  '  date: 2026-08-09T20:45:00+08:00',
  '  venue: Sultan Ibrahim Stadium',
  '  home: jdt-ii',
  '  away: kedah',
  '  status: scheduled',
  '',
].join('\n');

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
        withFixtureEntry(
          SCHEDULED_FIXTURE.replace('2026-08-02T20:45:00+08:00', '2026-08-02T20:45:00'),
        ),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/explicit UTC offset/);
          expect(output).toMatch(/2026-08-02-jdt-ii-h/);
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
          `${text}- id: kedah\n  team: kedah\n  won: 1\n  drawn: 1\n  lost: 4\n  goalsFor: 4\n  goalsAgainst: 15\n`,
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/Duplicate ids/);
          expect(output).toMatch(/standings\.yaml/);
          expect(output).toMatch(/"kedah" appears 2 times/);
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
        withFixtureEntry(SCHEDULED_FIXTURE.replace('  status: scheduled', '  status: finished')),
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
    'fails a squad dateOfBirth written in ambiguous US date-slash format',
    () => {
      // "11/03/1995" is a UK-format date an editor could easily type,
      // meaning 11 March — but js-yaml never recognises it as a YAML
      // timestamp (it isn't ISO-shaped), so it reaches Zod as a bare string
      // and native `new Date("11/03/1995")` parses it as US month/day/year
      // (3 November). Worse, under TZ=UTC the parsed instant lands on exact
      // UTC midnight, so the old post-coercion "is this UTC midnight" guard
      // passed it clean — the guard was silently absent on exactly the
      // timezone this build runs under (see the TZ=UTC env in runBuild()
      // above, matching Cloudflare/CI). This must fail here, under UTC, or
      // the regression is invisible to this suite.
      withMutatedFile(
        'src/data/squad.yaml',
        (text) => text.replace('dateOfBirth: 1995-03-11', 'dateOfBirth: 11/03/1995'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/must be a plain date with no time component/);
          expect(output).toMatch(/dateOfBirth/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a news article date with a time component',
    () => {
      withMutatedFile(
        'src/content/news/ibrahima-barry-joins-kedah.md',
        (text) => text.replace('date: 2026-08-05', 'date: 2026-08-05T23:30:00'),
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
        withFixtureEntry(SCHEDULED_FIXTURE.replace('  away: jdt-ii', '  away: not-a-real-team')),
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

  it(
    'fails a slide whose image is missing from public/',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        // Matches the "image:" key rather than a specific filename: this case
        // spent months silently passing its mutation over a seed path that no
        // longer existed, so withMutatedFile's "did not change anything" guard
        // was all that fired. A key-anchored regex cannot rot that way.
        // Only the first occurrence is replaced, so exactly one slide breaks.
        (text) => text.replace(/^  image: .*$/m, '  image: /images/slides/not-here.jpg'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/Referenced files are missing from public/);
          expect(output).toMatch(/not-here\.jpg/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a slide href that is protocol-relative rather than site-relative or https',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        (text) => text.replace('href: /news/ibrahima-barry-joins-kedah', 'href: //evil.com'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/A slide href must be a site-relative path like "\/news\/slug" or an absolute https:\/\/ URL\./);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a slide that has a cta label but nothing to link it to',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        // No slide carries a "cta" today, so this cannot be produced by
        // deleting an href — the old version deleted a "/contact" href that
        // stopped existing, and the case silently stopped guarding anything.
        // Swapping the first slide's href FOR a cta creates the invalid
        // combination directly, whatever the curated slides happen to be.
        (text) => text.replace(/^  href: .*$/m, '  cta: Buy Tickets'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/also needs an "href"/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a slide objectPosition that is not one of the anchors CSS understands',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        // objectPosition is interpolated into a style attribute, so the schema
        // is the only thing standing between a YAML typo and arbitrary CSS on
        // the page. An enum, not a free string, is what makes that safe — this
        // case is what proves the enum is still there.
        (text) => text.replace('objectPosition: right', 'objectPosition: diagonal'),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/objectPosition/);
          // Zod names the permitted set rather than echoing the bad value, so
          // the anchors are what this asserts on. That is the stronger check
          // anyway: it fails if anyone widens the enum back to a bare string.
          expect(output).toMatch(/"top"\|"right"\|"bottom"\|"left"\|"center"/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a fixture tickets URL that is protocol-relative rather than site-relative or https',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        withFixtureEntry(
          SCHEDULED_FIXTURE.replace(
            '  status: scheduled\n',
            '  status: scheduled\n  tickets: //evil.com\n',
          ),
        ),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(
            /A fixture tickets URL must be a site-relative path like "\/tickets" or an absolute https:\/\/ URL\./,
          );
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails a fixture stream URL that hides its authority behind a backslash',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        withFixtureEntry(
          SCHEDULED_FIXTURE.replace(
            '  status: scheduled\n',
            '  status: scheduled\n  stream: /\\evil.com\n',
          ),
        ),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(
            /A fixture stream URL must be a site-relative path like "\/watch" or an absolute https:\/\/ URL\./,
          );
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );

  it(
    'fails an away fixture that carries a tickets link',
    () => {
      withMutatedFile(
        'src/data/fixtures.yaml',
        withFixtureEntry(
          AWAY_FIXTURE.replace(
            '  status: scheduled\n',
            '  status: scheduled\n  tickets: https://example.com/tickets\n',
          ),
        ),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/only sold for home matches/);
          expect(output).toMatch(/2026-08-09-jdt-ii-a: tickets/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );
});
