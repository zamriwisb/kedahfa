# A1 Semi-Pro League Teams — Design

Date: 2026-07-26
Status: Approved

## Problem

`src/data/teams.yaml` holds six placeholder Malaysia Super League clubs
(Kedah, JDT, Selangor, Terengganu, Penang, Sabah) carried over from the initial
build. Kedah FA actually competes in the A1 Semi-Pro League, whose 2026/27
season has twelve clubs and has not yet kicked off.

`standings.yaml` mirrors the placeholder six with invented results, and
`fixtures.yaml` contains six demo matches — three with scores — against clubs
that will not be in the league.

## Goal

Replace the league data with the real twelve-club A1 Semi-Pro 2026/27 field,
zeroed for a season that has not started, using monogram placeholder crests
until the club supplies real logos.

Scope is `src/data/` and `public/images/teams/`, plus the two test files
coupled to the demo match data. No component, layout or schema changes.

## Data

### `src/data/teams.yaml` — twelve clubs

| id | name | shortName | crest |
|---|---|---|---|
| `jdt-ii` | Johor Darul Ta'zim II | JDT2 | `/images/teams/jdt-ii.svg` |
| `selangor-ii` | Selangor FC II | SEL2 | `/images/teams/selangor-ii.svg` |
| `kedah` | Kedah Football Association | KDH | `/images/teams/kedah.png` |
| `negeri-sembilan-ii` | Negeri Sembilan FC II | NS2 | `/images/teams/negeri-sembilan-ii.svg` |
| `usm` | USM FC | USM | `/images/teams/usm.svg` |
| `perak` | Perak FA | PRK | `/images/teams/perak.svg` |
| `um-damansara` | UM-Damansara United | UMD | `/images/teams/um-damansara.svg` |
| `kelantan-city` | Kelantan City FC | KCFC | `/images/teams/kelantan-city.svg` |
| `armed-forces` | Armed Forces FC | AFFC | `/images/teams/armed-forces.svg` |
| `uitm` | Malaysian University-UITM | UITM | `/images/teams/uitm.svg` |
| `manjung-city` | Manjung City FC | MCFC | `/images/teams/manjung-city.svg` |
| `bunga-raya` | Bunga Raya FC | BRFC | `/images/teams/bunga-raya.svg` |

`kedah` keeps its existing id. `src/data/club.yaml`, the squad pages and
`tableSnippet()`'s club-row fallback all key off that slug; renaming it would
silently drop Kedah's highlighted row from the homepage table.

The `shortName` schema caps the field at four characters
(`src/content.config.ts:144`), which is why the reserve sides use `JDT2`,
`SEL2` and `NS2` rather than the broadcast form "JDT II".

The list is ordered as the league announcement presents it, not
alphabetically. Order in the file has no effect on rendering — `deriveTable()`
sorts the table itself.

### Placeholder crests

One SVG per club at `public/images/teams/<id>.svg`, drawing the club's
`shortName` in white on a neutral slate disc. Deliberately monochrome and
club-neutral: a placeholder that borrowed club colours would be mistaken for
the real crest.

Constraints the files must satisfy:

- Rendered at 40×40 with `object-contain` (`MatchRow.astro:53`,
  `StandingsTable.astro:98`), so a square `viewBox` and no reliance on
  fine detail.
- Loaded via `<img src>`, so no external stylesheet or webfont — the monogram
  uses a system sans stack, with `textLength` so four-character codes stay
  inside the disc.
- Path must start with `/images/teams/` (`src/content.config.ts:145`) and the
  file must exist under `public/` (`assertPublicAssetsExist`,
  `src/lib/validate.ts:109`).

Kedah keeps the real full-colour `kedah.png` added in 66d933f.

The five crests belonging to departing clubs — `jdt.svg`, `penang.svg`,
`sabah.svg`, `selangor.svg`, `terengganu.svg` — are deleted. Nothing else
references them.

### `src/data/standings.yaml` — twelve zeroed rows

One row per club with `won`, `drawn`, `lost`, `goalsFor` and `goalsAgainst`
all `0`. Each row's `id` equals its `team` slug, as the schema's refinement
requires (`src/content.config.ts:194`).

Played, points, goal difference and position stay derived in
`deriveTable()` — they are never written by hand.

With every row identical, the sort falls through points, goal difference and
goals scored to its final tie-break, `a.name.localeCompare(b.name)`. The
pre-season table therefore lists all twelve alphabetically, which is both
deterministic and the conventional way to show a table before a ball is
kicked.

### `src/data/fixtures.yaml` — emptied

The A1 2026/27 schedule has not been published. The file is reduced to
comments documenting the entry shape (including the finished-match score rule)
so adding real fixtures later is copy-paste, followed by an explicit `[]`.

That `[]` is required, not decorative. A comments-only file parses to `null`,
and both `parseFixturesYaml` (`src/content.config.ts:19`) and
`assertNoDuplicateIds` (`src/lib/validate.ts:54`) throw on a non-array — the
build fails with "must contain a YAML array of fixture entries".

A genuinely empty list is already handled: both `FixturesStrip.astro:75` and
`fixtures.astro:56` render `EmptyState` with "No fixtures are currently
scheduled."

The `kedah-edge-selangor` news article stays in `src/content/news/`. It loses
only the fixture that linked to it via `report:`; the article and its route are
unaffected.

### `src/data/season.yaml`

```yaml
- id: current
  competition: A1 Semi-Pro League 2026/27
  standingsUpdated: 2026-07-26
```

## Verification

`npm run build` runs `astro check` and the cross-entry invariants in
`src/lib/validate.ts`, which between them cover the failure modes this change
can introduce:

- `assertReferencesResolve` — a standings row or fixture naming a club absent
  from `teams.yaml` fails the build and prints every known id.
- `assertNoDuplicateIds` — a repeated slug fails rather than silently
  overwriting, which is what Astro's `file()` loader would otherwise do.
- `assertPublicAssetsExist` — a `crest:` path with no file behind it fails.
- The Zod schemas catch a `shortName` over four characters, a crest path
  outside `/images/teams/`, and a standings row whose `id` and `team` disagree.

`npm test` runs the unit suite, including `deriveTable`'s ordering.

A new `tests/unit/league-data.test.ts` locks the invariant nothing else
covers: `assertReferencesResolve` proves every standings row points at a real
club, but nothing proves every club *has* a row, so a team could silently
vanish from the table. It asserts the roster count, the teams↔standings
correspondence, the all-zero pre-season state and the crest files' existence.

### Tests coupled to the demo data

Emptying the fixture list breaks nine tests that assert against the demo
matches rather than building their own. They are fixed as part of this change.

`tests/unit/build-negative.test.ts` — four cases mutate a real data file and
assert the build fails. They depend on the literal string
`away: jdt\n  status: scheduled` and on `jdt` being present in
`standings.yaml`. Each is rewritten to supply the fixture it needs (swapping
the `[]` marker for a valid entry, then corrupting that), and the
duplicate-id case duplicates `kedah` instead of `jdt`. This decouples them
from whatever the real schedule happens to contain.

`tests/e2e/content.spec.ts` — five cases need fixtures to exist. The homepage
countdown, the fixtures-page section headings and the derived-points
assertions become pre-season assertions: the empty state, twelve rowheaders,
and Kedah on zero points. The kickoff-time and match-report cases are deleted
outright; the behaviour they covered lives in `tests/unit/dates.test.ts` and
the news-filter case.

The unit tests for the logic itself — `fixtures.test.ts`, `standings.test.ts`,
`dates.test.ts` — construct their own data and are unaffected.

Manual check: the standings page lists twelve clubs, every row reads
`P 0 · W 0 · D 0 · L 0 · GD 0 · Pts 0`, each crest shows its monogram, and the
fixtures page and homepage strip show the empty state.

## Follow-up (out of scope)

Real logos replace the monogram SVGs when the club supplies them: drop the
files into `public/images/teams/` and update the `crest:` extension in
`teams.yaml`. The `shortName` codes are inferred from club names, not taken
from an official league list — worth confirming against A1 team-sheet
abbreviations before launch.

When the A1 schedule is published, the fixtures go in and the two deleted
e2e cases — kickoff rendered in Malaysian time, and the report link from a
fixture row to its article — should be restored against a real match.
