# A1 Semi-Pro League Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six placeholder Super League clubs with the twelve A1 Semi-Pro 2026/27 clubs, zeroed for a season that has not kicked off.

**Architecture:** Data-only change to `src/data/*.yaml` plus monogram placeholder crests in `public/images/teams/`. No schema, component or layout changes. Two existing test files are coupled to the demo match data and are decoupled as part of the work.

**Tech Stack:** Astro 7 content collections (`file()` loader + Zod), YAML data files, Vitest for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-07-26-a1-league-teams-design.md`

## Global Constraints

- `shortName` is capped at four characters (`src/content.config.ts:144`). Never exceed it.
- A `crest:` path must start with `/images/teams/` (`src/content.config.ts:145`) and the file must exist under `public/` or the build fails.
- A standings row's `id` must equal its `team` slug (`src/content.config.ts:194`).
- `played`, `points`, `goalDifference` and `position` are derived in `deriveTable()` — never stored in YAML.
- Kedah's slug stays `kedah`. `src/data/club.yaml`, the squad pages and `tableSnippet()`'s club-row fallback key off it.
- A finished fixture requires a `score`; a scheduled or postponed one must not have it (`src/content.config.ts:171`).
- Fixture dates require an explicit UTC offset (`FIXTURE_DATE_PATTERN`).
- Commit messages use the repo's conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`) and end with the `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Pre-season league data and placeholder crests

Swaps the league roster, zeroes the table, empties the fixture list, and decouples `build-negative.test.ts` from the demo matches it currently mutates. The deliverable is a green `npm run build` and a green `npm test`.

**Files:**
- Create: `tests/unit/league-data.test.ts`
- Create: `public/images/teams/{jdt-ii,selangor-ii,negeri-sembilan-ii,usm,perak,um-damansara,kelantan-city,armed-forces,uitm,manjung-city,bunga-raya}.svg` (11 files)
- Delete: `public/images/teams/{jdt,penang,sabah,selangor,terengganu}.svg` (5 files)
- Modify: `src/data/teams.yaml` (replace entirely)
- Modify: `src/data/standings.yaml` (replace entirely)
- Modify: `src/data/fixtures.yaml` (replace entirely)
- Modify: `src/data/season.yaml:2-3`
- Modify: `tests/unit/build-negative.test.ts` (4 of the 8 cases)

**Interfaces:**
- Consumes: `deriveTable()` and `tableSnippet()` from `src/lib/standings.ts` (unchanged), the validators in `src/lib/validate.ts` (unchanged).
- Produces: the twelve team slugs `jdt-ii`, `selangor-ii`, `kedah`, `negeri-sembilan-ii`, `usm`, `perak`, `um-damansara`, `kelantan-city`, `armed-forces`, `uitm`, `manjung-city`, `bunga-raya`. Task 2's e2e assertions rely on these and on `src/data/fixtures.yaml` containing no entries.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/league-data.test.ts`. This locks an invariant no existing check covers: `validate.ts` proves every standings row *references* a real team, but nothing proves every team *has* a row, so a club could silently vanish from the table.

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// js-yaml@5 ships only named ESM exports — a default import is undefined here.
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  crest: string;
}

interface StandingsRow {
  id: string;
  team: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

function readYaml<T>(relativePath: string): T[] {
  return load(readFileSync(join(ROOT, relativePath), 'utf-8')) as T[];
}

const teams = readYaml<TeamRow>('src/data/teams.yaml');
const standings = readYaml<StandingsRow>('src/data/standings.yaml');

describe('src/data/teams.yaml', () => {
  it('lists the twelve A1 Semi-Pro 2026/27 clubs', () => {
    expect(teams).toHaveLength(12);
  });

  it('keeps Kedah on the slug the club pages and homepage table key off', () => {
    expect(teams.map((t) => t.id)).toContain('kedah');
  });

  it('has no duplicate slugs', () => {
    expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
  });

  it('keeps every shortName within the four-character schema cap', () => {
    const tooLong = teams.filter((t) => t.shortName.length > 4);
    expect(tooLong.map((t) => t.id)).toEqual([]);
  });

  it('points every crest at a file that exists in public/', () => {
    const missing = teams.filter(
      (t) => !existsSync(join(ROOT, 'public', t.crest.replace(/^\//, ''))),
    );
    expect(missing.map((t) => t.crest)).toEqual([]);
  });
});

describe('src/data/standings.yaml', () => {
  it('has exactly one row per team, and no rows for departed clubs', () => {
    expect(standings.map((r) => r.team).sort()).toEqual(teams.map((t) => t.id).sort());
  });

  it('uses each row id as its own team slug, as the schema requires', () => {
    const mismatched = standings.filter((r) => r.id !== r.team);
    expect(mismatched.map((r) => r.id)).toEqual([]);
  });

  it('is zeroed because the season has not kicked off', () => {
    const played = standings.filter(
      (r) => r.won + r.drawn + r.lost + r.goalsFor + r.goalsAgainst !== 0,
    );
    expect(played.map((r) => r.id)).toEqual([]);
  });
});

describe('src/data/fixtures.yaml', () => {
  it('is an explicit empty array until the A1 schedule is published', () => {
    const fixtures = load(readFileSync(join(ROOT, 'src/data/fixtures.yaml'), 'utf-8'));
    // Not merely "no fixtures": a comments-only file parses to null, and
    // both parseFixturesYaml (src/content.config.ts:19) and
    // assertNoDuplicateIds (src/lib/validate.ts:54) throw on a non-array.
    // The empty list has to be a real [] or the build fails.
    expect(Array.isArray(fixtures)).toBe(true);
    expect(fixtures).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/league-data.test.ts
```

Expected: FAIL. `expect(teams).toHaveLength(12)` reports `6`, the standings roster comparison reports the old six slugs, and the fixtures assertion reports the six demo matches.

- [ ] **Step 3: Generate the placeholder crests**

Write this script to the scratchpad (not the repo — it is throwaway once real logos arrive) and run it:

```bash
cat > /private/tmp/claude-501/-Users-zamri-Projects-company-kedahfa-website/7f0e90da-3caa-43e3-a860-42b88d9ac2a7/scratchpad/make-crests.mjs <<'EOF'
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Monogram placeholders, deliberately monochrome: a crest borrowing club
// colours would be mistaken for the real thing. Replaced when the club
// supplies logos.
const CLUBS = [
  ['jdt-ii', 'JDT2'],
  ['selangor-ii', 'SEL2'],
  ['negeri-sembilan-ii', 'NS2'],
  ['usm', 'USM'],
  ['perak', 'PRK'],
  ['um-damansara', 'UMD'],
  ['kelantan-city', 'KCFC'],
  ['armed-forces', 'AFFC'],
  ['uitm', 'UITM'],
  ['manjung-city', 'MCFC'],
  ['bunga-raya', 'BRFC'],
];

const OUT = 'public/images/teams';

for (const [id, monogram] of CLUBS) {
  // Rendered at 40x40 with object-contain, so the disc fills the viewBox and
  // textLength keeps four-character codes inside it. No webfont: the file is
  // loaded through <img>, where an external stylesheet would never apply.
  const textLength = monogram.length >= 4 ? 40 : 32;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${monogram}">
  <circle cx="32" cy="32" r="31" fill="#334155"/>
  <circle cx="32" cy="32" r="31" fill="none" stroke="#64748b" stroke-width="2"/>
  <text x="32" y="32" fill="#f8fafc" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" text-anchor="middle" dominant-baseline="central" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">${monogram}</text>
</svg>
`;
  writeFileSync(join(OUT, `${id}.svg`), svg);
}

console.log(`wrote ${CLUBS.length} crests`);
EOF
node /private/tmp/claude-501/-Users-zamri-Projects-company-kedahfa-website/7f0e90da-3caa-43e3-a860-42b88d9ac2a7/scratchpad/make-crests.mjs
```

Expected output: `wrote 11 crests`

- [ ] **Step 4: Delete the crests of the departing clubs**

```bash
git rm public/images/teams/jdt.svg public/images/teams/penang.svg public/images/teams/sabah.svg public/images/teams/selangor.svg public/images/teams/terengganu.svg
```

Expected: five `rm` lines. `kedah.png` is untouched — it is the real crest added in 66d933f.

- [ ] **Step 5: Replace `src/data/teams.yaml`**

Ordered as the league announcement presents the clubs. File order does not affect rendering — `deriveTable()` sorts the table itself.

```yaml
# The twelve clubs of the A1 Semi-Pro League 2026/27.
#
# Crests are monogram placeholders except Kedah's. To swap in a real logo,
# drop the file into public/images/teams/ and update the crest path below —
# the build fails if the file is missing.
#
# shortName is capped at four characters by the schema, which is why the
# reserve sides read JDT2/SEL2/NS2 rather than the broadcast "JDT II".
- id: jdt-ii
  name: Johor Darul Ta'zim II
  shortName: JDT2
  crest: /images/teams/jdt-ii.svg
- id: selangor-ii
  name: Selangor FC II
  shortName: SEL2
  crest: /images/teams/selangor-ii.svg
- id: kedah
  name: Kedah Football Association
  shortName: KDH
  crest: /images/teams/kedah.png
- id: negeri-sembilan-ii
  name: Negeri Sembilan FC II
  shortName: NS2
  crest: /images/teams/negeri-sembilan-ii.svg
- id: usm
  name: USM FC
  shortName: USM
  crest: /images/teams/usm.svg
- id: perak
  name: Perak FA
  shortName: PRK
  crest: /images/teams/perak.svg
- id: um-damansara
  name: UM-Damansara United
  shortName: UMD
  crest: /images/teams/um-damansara.svg
- id: kelantan-city
  name: Kelantan City FC
  shortName: KCFC
  crest: /images/teams/kelantan-city.svg
- id: armed-forces
  name: Armed Forces FC
  shortName: AFFC
  crest: /images/teams/armed-forces.svg
- id: uitm
  name: Malaysian University-UITM
  shortName: UITM
  crest: /images/teams/uitm.svg
- id: manjung-city
  name: Manjung City FC
  shortName: MCFC
  crest: /images/teams/manjung-city.svg
- id: bunga-raya
  name: Bunga Raya FC
  shortName: BRFC
  crest: /images/teams/bunga-raya.svg
```

- [ ] **Step 6: Replace `src/data/standings.yaml`**

```yaml
# Only match observations live here. Played, points, goal difference and
# position are derived in src/lib/standings.ts — never write them by hand.
#
# The 2026/27 season has not kicked off, so every row is zero. With all rows
# equal, deriveTable() falls through to its alphabetical tie-break, so the
# table renders in name order until the first results are entered.
#
# A row's id must equal its team slug.
- id: jdt-ii
  team: jdt-ii
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: selangor-ii
  team: selangor-ii
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: kedah
  team: kedah
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: negeri-sembilan-ii
  team: negeri-sembilan-ii
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: usm
  team: usm
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: perak
  team: perak
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: um-damansara
  team: um-damansara
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: kelantan-city
  team: kelantan-city
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: armed-forces
  team: armed-forces
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: uitm
  team: uitm
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: manjung-city
  team: manjung-city
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
- id: bunga-raya
  team: bunga-raya
  won: 0
  drawn: 0
  lost: 0
  goalsFor: 0
  goalsAgainst: 0
```

- [ ] **Step 7: Replace `src/data/fixtures.yaml`**

The A1 2026/27 schedule has not been published. The file keeps only its format documentation, plus an explicit empty array.

**The trailing `[]` is load-bearing.** A comments-only file parses to `null`, and both `parseFixturesYaml` (`src/content.config.ts:19`) and `assertNoDuplicateIds` (`src/lib/validate.ts:54`) throw on anything that is not an array — the build would fail with "must contain a YAML array of fixture entries". Do not drop it.

With a genuine empty array, both `FixturesStrip.astro:75` and `fixtures.astro:56` render "No fixtures are currently scheduled."

```yaml
# The A1 Semi-Pro League 2026/27 schedule has not been published yet.
# Until it is, this file holds an empty list and the fixtures page and
# homepage strip show their empty state.
#
# Add matches as a YAML array. Copy this shape:
#
# - id: 2026-08-02-jdt-ii-h        # unique; convention is date-opponent-h/a
#   competition: A1 Semi-Pro League
#   matchweek: 1                   # optional, omit for cup ties
#   date: 2026-08-02T20:45:00+08:00  # the +08:00 offset is required
#   venue: Darul Aman Stadium
#   home: kedah                    # must be a slug from teams.yaml
#   away: jdt-ii
#   status: scheduled              # scheduled | finished | postponed
#
# Finished matches carry a score. Scheduled and postponed matches must not:
#
#   status: finished
#   score: { home: 3, away: 2 }
#   report: kedah-edge-selangor    # optional, a slug from src/content/news/
#
# The empty array below is required: a file of only comments parses to null,
# which the fixtures parser and the duplicate-id check both reject.
[]
```

- [ ] **Step 8: Update `src/data/season.yaml`**

```yaml
- id: current
  competition: A1 Semi-Pro League 2026/27
  standingsUpdated: 2026-07-26
```

- [ ] **Step 9: Run the new test to verify it passes**

```bash
npx vitest run tests/unit/league-data.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 10: Run the build**

```bash
npm run build
```

Expected: exit 0. This is what proves `assertReferencesResolve`, `assertNoDuplicateIds` and `assertPublicAssetsExist` are all satisfied — a typo'd slug or a missing crest fails here by name.

- [ ] **Step 11: Confirm the expected build-negative breakage**

```bash
npx vitest run tests/unit/build-negative.test.ts
```

Expected: FAIL — four cases. They mutate demo matches that no longer exist, and `withMutatedFile()` throws `Test bug: mutate() for src/data/fixtures.yaml did not change anything.` Steps 12–13 fix them. Do not skip ahead to a commit before they are green.

- [ ] **Step 12: Decouple `build-negative.test.ts` from the demo matches**

Add this constant directly below `const BUILD_TIMEOUT_MS = 120_000;` (`tests/unit/build-negative.test.ts:24`):

```ts
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
    /^\[\]\s*$/m.test(text) ? text.replace(/^\[\]\s*$/m, entry) : text + entry;
}
```

Then replace the four coupled cases. Case 1 — "fails a fixture date with no UTC offset" (currently `:65-80`):

```ts
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
```

Case 2 — "fails a duplicate id in standings.yaml" (currently `:82-99`). The appended row duplicates `kedah`, which is in the new table:

```ts
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
```

Case 3 — "fails a finished fixture with no score" (currently `:101-115`):

```ts
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
```

Case 4 — "fails a fixture referencing a team slug that does not exist" (currently `:161-176`):

```ts
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
```

Leave the other four cases (squad `dateOfBirth`, news article date, and the two slide cases) untouched — they mutate files this change does not affect.

- [ ] **Step 13: Run the full unit suite**

```bash
npm test
```

Expected: PASS, all files green including `build-negative.test.ts`. This file runs a real `astro build` per case, so it takes tens of seconds.

- [ ] **Step 14: Commit**

```bash
git add src/data/teams.yaml src/data/standings.yaml src/data/fixtures.yaml src/data/season.yaml \
        public/images/teams tests/unit/league-data.test.ts tests/unit/build-negative.test.ts
git commit -m "$(cat <<'EOF'
feat: replace the league with the twelve A1 Semi-Pro 2026/27 clubs

The season has not kicked off, so every standings row is zero and the
fixture list is empty until the schedule is published. Crests are monogram
placeholders pending the clubs' real logos; Kedah keeps its own.

The four build-negative cases that mutated demo matches now append the
fixture they need, so they no longer depend on what is in fixtures.yaml.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Point the e2e suite at the pre-season site

Five `content.spec.ts` cases assert against demo matches that no longer exist. This rewrites them to describe the site as it now is.

**Files:**
- Modify: `tests/e2e/content.spec.ts:3-12, 19-25, 27-35, 37-41, 54-59`
- Test: `tests/e2e/content.spec.ts` (the file under change is itself the test)

**Interfaces:**
- Consumes: the twelve slugs and the empty fixture list produced by Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Run the e2e suite to see the failures first**

```bash
npx playwright test tests/e2e/content.spec.ts
```

Expected: FAIL, 5 of 9 cases — the countdown never appears, JDT is absent from the standings table, the Upcoming/Postponed/Results headings are gone, no `20:45` renders, and there is no Report link.

- [ ] **Step 2: Replace the countdown case (`:3-12`)**

`FixturesStrip.astro:41-55` renders `Countdown` only when `nextMatch()` returns a match, so with no fixtures there is nothing to count down to. Assert the empty state instead:

```ts
test('the homepage fixtures strip shows the pre-season empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No fixtures are currently scheduled.')).toBeVisible();
});
```

- [ ] **Step 3: Replace the derived-points case (`:19-25`)**

The derivation arithmetic has nothing to bite on while every row is zero; `tests/unit/standings.test.ts` covers that math directly. What is worth asserting here is that all twelve clubs render and the table is genuinely pre-season:

```ts
test('the standings table lists all twelve clubs, zeroed for the pre-season', async ({ page }) => {
  await page.goto('/standings');

  // One rowheader per club; the header row contributes none.
  await expect(page.getByRole('rowheader')).toHaveCount(12);

  // Last cell of a row is its points total.
  const kedah = page.getByRole('row').filter({ hasText: 'Kedah Football Association' });
  await expect(kedah.getByRole('cell').last()).toHaveText('0');
});
```

- [ ] **Step 4: Replace the fixtures-page sections case (`:27-35`)**

```ts
test('the fixtures page shows the empty state until the schedule is published', async ({ page }) => {
  await page.goto('/fixtures');
  await expect(page.getByText('No fixtures are currently scheduled.')).toBeVisible();
});
```

- [ ] **Step 5: Delete the kickoff-time case (`:37-41`) and the match-report case (`:54-59`)**

Both need a fixture to assert against. Delete them outright rather than leaving them skipped — Malaysian-time formatting stays covered by `tests/unit/dates.test.ts`, and the news article they reached is still exercised by the news-filter case. Restore both when the real schedule lands; the spec's follow-up section records this.

- [ ] **Step 6: Run the e2e suite to verify it passes**

```bash
npx playwright test tests/e2e/content.spec.ts
```

Expected: PASS, 7 cases (9 minus the 2 deleted).

- [ ] **Step 7: Run the whole e2e suite**

```bash
npm run test:e2e
```

Expected: PASS. `accessibility.spec.ts`, `layout.spec.ts` and `navigation.spec.ts` only visit `/fixtures` as a route, so an empty page is fine for them.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/content.spec.ts
git commit -m "$(cat <<'EOF'
test: assert the pre-season empty state instead of demo fixtures

The countdown, kickoff-time and match-report cases needed matches that no
longer exist. Kickoff formatting stays covered by dates.test.ts and the
standings arithmetic by standings.test.ts; restore the fixture cases when
the A1 schedule is published.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification

After both tasks:

```bash
npm run build      # exit 0 — Zod schemas and the validate.ts invariants
npm test           # unit suite, including the real-build negative cases
npm run test:e2e   # Playwright
```

Manual check with `astro dev --background`: `/standings` lists twelve clubs alphabetically with every figure at zero and a monogram beside each name, `/fixtures` and the homepage strip show "No fixtures are currently scheduled.", and the standings page heading reads "A1 Semi-Pro League 2026/27".
