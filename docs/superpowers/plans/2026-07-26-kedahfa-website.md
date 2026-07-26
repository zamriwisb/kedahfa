# Kedah FA Official Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the official Kedah FA website — a static, mobile-first club site covering news, squad, fixtures and results, league standings, sponsors and contact.

**Architecture:** Astro renders every page to static HTML at build time. Content is Markdown (news prose) and YAML (structured records), both loaded through Astro's Content Layer with Zod schemas so malformed content fails the build rather than rendering wrong. All derivation and formatting logic lives in pure functions under `src/lib/` with no Astro imports, which is what the unit tests target; `.astro` components stay presentational. Exactly three client-side islands ship JavaScript: the countdown, the mobile nav, and the list filters.

**Tech Stack:** Astro 7.1.3, Tailwind CSS 4.3.3, TypeScript (strict), Vitest 4.1.10, Playwright 1.62.0, Node 22.12+.

**Source spec:** `docs/superpowers/specs/2026-07-26-kedahfa-website-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Node `>=22.12.0`** — required by Astro 7. Verify with `node -v` before Task 1.
- **Static output only.** No SSR adapter, no server endpoints. `astro build` must emit a self-contained `dist/`.
- **All match times are `Asia/Kuala_Lumpur`.** Stored as ISO 8601 with an explicit `+08:00` offset; formatted only through `src/lib/dates.ts`, never with bare `toLocaleString()`. CI builds run in UTC, and an unqualified format shifts an evening kickoff to the wrong calendar day.
- **The pure modules in `src/lib/` must not import from `astro:content` or any `.astro` file.** This binds `dates.ts`, `standings.ts`, `fixtures.ts`, `squad.ts`, `pagination.ts` and `validate.ts` — they hold pure functions so Vitest can run them directly. `src/lib/content.ts` is the single deliberate exception: it is the Astro bridge that reads collections and hands plain data to those pure modules, and it is covered by the build and the e2e suite rather than by unit tests.
- **No external network requests from the built site.** Fonts are self-hosted via Fontsource. No Google Fonts, no CDN scripts, no external analytics.
- **English only.** No i18n routing or language switcher.
- **Accessibility is a build requirement, not a polish pass.** Every image needs alt text, every interactive target is at least 44×44px, all text meets WCAG AA contrast, all motion respects `prefers-reduced-motion`.
- **All brand values live in `src/styles/tokens.css`.** No hard-coded hex colours anywhere else.
- **Placeholder branding.** The red/gold palette and the crest are stand-ins, not verified Kedah colours. Do not present them as official.
- **Commit after every task.** Conventional commit prefixes (`feat:`, `test:`, `chore:`).

## Deviations from the spec

The spec was written before package versions were checked. These changes are deliberate; implement the plan, not the spec, where they conflict.

1. **Astro 7.1.3, not Astro 5.** Astro 5 was current when the spec was written; 7.1.3 is current now. The Content Layer API used throughout (`glob()`, `file()`, `reference()`) is unchanged between them.
2. **`standings.yaml` is a flat array, not a nested object.** Astro's `file()` loader requires an array of entries or an object map. The `competition` and `updated` fields the spec put at the top of that file move to a new `src/data/season.yaml`.
3. **`club.yaml` and `season.yaml` are single-entry arrays.** Same loader constraint. Each holds one record with a fixed `id`, queried with `getEntry()`. This keeps every data file on one validated pipeline and avoids adding a YAML-parsing dependency.
4. **The spec's sample fixture called 2 August 2026 a Saturday. It is a Sunday.** Sample data in this plan uses verified weekdays.

## Operational note: rebuilds

The site is static, so "next match" and "recent results" are computed at build time. After a match is played, the homepage keeps showing that match as upcoming until the next deploy. Editing `fixtures.yaml` to add the score triggers a deploy and resolves it, which is the normal workflow. As a safety net, configure a daily scheduled deploy in Cloudflare Pages (Task 14) so the site self-corrects even if nobody commits.

## File structure

| File | Responsibility |
|---|---|
| `astro.config.mjs` | Static output, site URL, Tailwind + sitemap plugins |
| `src/content.config.ts` | Every collection schema and loader — single source of truth for content shape |
| `src/data/*.yaml` | Structured content: club, season, teams, fixtures, standings, squad, sponsors |
| `src/content/news/*.md` | One article per file |
| `src/lib/dates.ts` | Kuala Lumpur date/time formatting and countdown maths |
| `src/lib/standings.ts` | League table derivation and sorting |
| `src/lib/fixtures.ts` | Match partitioning, next-match, recent-results, hero selection, month grouping |
| `src/lib/squad.ts` | Position grouping and ordering |
| `src/lib/validate.ts` | Cross-entry invariants Zod cannot express (uniqueness, asset existence) |
| `src/lib/content.ts` | Thin Astro-aware loader: reads all collections once, runs validators, returns typed site data |
| `src/layouts/BaseLayout.astro` | HTML shell, head metadata, header, footer |
| `src/components/*.astro` | Presentational components |
| `src/components/islands/*.astro` | The three JavaScript islands |
| `src/pages/**` | Routes |
| `src/styles/tokens.css` | Brand tokens — the file swapped at rebrand |
| `tests/unit/*.test.ts` | Vitest against `src/lib/` |
| `tests/e2e/*.spec.ts` | Playwright smoke and accessibility |

---

## Task 1: Project scaffold and date utilities

Scaffolding is folded into this task because the date helpers are the first code that needs a test runner, and a bare scaffold has nothing to verify.

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/lib/dates.ts`
- Test: `tests/unit/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `CLUB_TIMEZONE: string`, `formatKickoffTime(date: Date): string`, `formatMatchDate(date: Date): string`, `formatArticleDate(date: Date): string`, `formatMonthHeading(date: Date): string`, `monthKey(date: Date): string`, `countdown(from: Date, to: Date): Countdown | null`, `interface Countdown { days: number; hours: number; minutes: number; seconds: number }`

- [ ] **Step 1: Verify the Node version**

```bash
node -v
```

Expected: `v22.12.0` or higher. Astro 7 refuses to install below this.

- [ ] **Step 2: Scaffold the Astro project into the current directory**

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git --skip-houston
```

Answer "Yes" if it asks to continue in a non-empty directory — the repo already holds `docs/` and `.git/`, which the template leaves alone.

- [ ] **Step 3: Install dependencies and add Tailwind**

```bash
npm install
npx astro add tailwind --yes
npm install -D vitest@4 @astrojs/check typescript
npm install @astrojs/sitemap @astrojs/rss
```

`astro add tailwind` wires the `@tailwindcss/vite` plugin into `astro.config.mjs` automatically. The old `@astrojs/tailwind` integration is deprecated — do not install it.

- [ ] **Step 4: Configure Astro for static output**

Replace `astro.config.mjs` with:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kedahfa.com',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 5: Configure Vitest to run in UTC**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Forces the timezone bug this project is most likely to ship.
    // Cloudflare builds in UTC; if the date helpers are correct only on a
    // machine set to Kuala Lumpur time, these tests must fail.
    env: { TZ: 'UTC' },
  },
});
```

- [ ] **Step 6: Add scripts to `package.json`**

Merge into the existing `"scripts"` block:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Write the failing date tests**

Create `tests/unit/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  countdown,
  formatArticleDate,
  formatKickoffTime,
  formatMatchDate,
  formatMonthHeading,
  monthKey,
} from '../../src/lib/dates';

const EVENING_KICKOFF = new Date('2026-08-02T20:45:00+08:00');
const AFTER_MIDNIGHT = new Date('2026-08-03T00:30:00+08:00');

describe('test environment', () => {
  it('runs in UTC so timezone bugs are reproducible', () => {
    expect(process.env.TZ).toBe('UTC');
  });
});

describe('formatKickoffTime', () => {
  it('formats an evening kickoff in Kuala Lumpur time, not UTC', () => {
    // 20:45+08:00 is 12:45 UTC. A naive formatter would print 12:45.
    expect(formatKickoffTime(EVENING_KICKOFF)).toBe('20:45');
  });

  it('renders midnight as 00:00, not 24:00', () => {
    expect(formatKickoffTime(new Date('2026-08-03T00:00:00+08:00'))).toBe('00:00');
  });
});

describe('formatMatchDate', () => {
  it('formats a standard kickoff', () => {
    expect(formatMatchDate(EVENING_KICKOFF)).toBe('Sun 02 Aug 2026');
  });

  it('keeps the local calendar day when UTC is still on the previous date', () => {
    // 00:30+08:00 on 3 Aug is 16:30 UTC on 2 Aug.
    expect(formatMatchDate(AFTER_MIDNIGHT)).toBe('Mon 03 Aug 2026');
  });
});

describe('formatArticleDate', () => {
  it('formats a publication date in long form without a leading zero', () => {
    expect(formatArticleDate(new Date('2026-07-19T16:00:00+08:00'))).toBe('19 July 2026');
  });
});

describe('formatMonthHeading', () => {
  it('formats a month and year for fixture list headings', () => {
    expect(formatMonthHeading(EVENING_KICKOFF)).toBe('August 2026');
  });
});

describe('monthKey', () => {
  it('produces a sortable key from the local month', () => {
    expect(monthKey(EVENING_KICKOFF)).toBe('2026-08');
  });

  it('assigns an after-midnight kickoff to its local month', () => {
    expect(monthKey(new Date('2026-09-01T00:30:00+08:00'))).toBe('2026-09');
  });
});

describe('countdown', () => {
  it('breaks the remaining time into days, hours, minutes and seconds', () => {
    const from = new Date('2026-07-29T09:23:15+08:00');
    expect(countdown(from, EVENING_KICKOFF)).toEqual({
      days: 4,
      hours: 11,
      minutes: 21,
      seconds: 45,
    });
  });

  it('returns null once the target has passed', () => {
    expect(countdown(new Date('2026-08-02T20:46:00+08:00'), EVENING_KICKOFF)).toBeNull();
  });

  it('returns null at the exact kickoff moment', () => {
    expect(countdown(EVENING_KICKOFF, EVENING_KICKOFF)).toBeNull();
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "../../src/lib/dates"`.

- [ ] **Step 9: Implement the date utilities**

Create `src/lib/dates.ts`:

```ts
/**
 * All club-facing dates and times are rendered in Malaysian time.
 * CI builds run in UTC, so every format here pins the timezone explicitly —
 * an unqualified formatter would shift a 20:45 kickoff to the previous day.
 */
export const CLUB_TIMEZONE = 'Asia/Kuala_Lumpur';

type PartMap = Record<string, string>;

/**
 * Builds the string from individual Intl parts rather than the joined output.
 * Part values are stable across ICU versions; the joined form (separators,
 * comma placement) is not.
 */
function partsIn(date: Date, options: Intl.DateTimeFormatOptions): PartMap {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIMEZONE,
    ...options,
  });
  const map: PartMap = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  return map;
}

export function formatKickoffTime(date: Date): string {
  // hourCycle h23 rather than hour12:false — the latter can yield "24:00".
  const p = partsIn(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}

export function formatMatchDate(date: Date): string {
  const p = partsIn(date, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

export function formatArticleDate(date: Date): string {
  const p = partsIn(date, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatMonthHeading(date: Date): string {
  const p = partsIn(date, { month: 'long', year: 'numeric' });
  return `${p.month} ${p.year}`;
}

export function monthKey(date: Date): string {
  const p = partsIn(date, { year: 'numeric', month: '2-digit' });
  return `${p.year}-${p.month}`;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;

export function countdown(from: Date, to: Date): Countdown | null {
  const remainingMs = to.getTime() - from.getTime();
  if (remainingMs <= 0) return null;

  const total = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(total / SECONDS_PER_DAY),
    hours: Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / 60),
    seconds: total % 60,
  };
}
```

- [ ] **Step 10: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS — 11 tests.

- [ ] **Step 11: Confirm the project builds**

```bash
npm run build
```

Expected: `astro check` reports 0 errors, build writes `dist/`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro project and add Kuala Lumpur date utilities"
```

---

## Task 2: Content schemas and sample data

**Files:**
- Create: `src/content.config.ts`
- Create: `src/data/club.yaml`, `src/data/season.yaml`, `src/data/teams.yaml`, `src/data/fixtures.yaml`, `src/data/standings.yaml`, `src/data/squad.yaml`, `src/data/sponsors.yaml`
- Create: `src/content/news/kedah-edge-selangor.md`, `src/content/news/academy-trials-open.md`, `src/content/news/new-signing-announced.md`

**Interfaces:**
- Consumes: nothing
- Produces: collections named `club`, `season`, `teams`, `fixtures`, `standings`, `squad`, `sponsors`, `news`, queryable with `getCollection(name)` / `getEntry(name, id)`. Field names below are relied on by every later task.

- [ ] **Step 1: Write the collection schemas**

**`reference()` does NOT verify that the referenced entry exists.** Verified
against Astro 7.1.3: a fixture naming a team slug absent from `teams.yaml`
builds successfully with exit 0. `reference()` supplies typing and transforms a
slug string into `{ collection, id }`, but performs no lookup in the target
collection. Zod refinements cannot close the gap either — they see one entry at
a time and cannot query another collection.

Referential integrity is therefore enforced in Task 5's `loadSiteData()`, the
one place that holds every collection at once. **Task 2 delivers shape and
intra-entry validation only.** Do not attempt to enforce existence here.

Create `src/content.config.ts`:

```ts
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const club = defineCollection({
  loader: file('src/data/club.yaml'),
  schema: z.object({
    id: z.literal('club'),
    name: z.string(),
    shortName: z.string(),
    founded: z.number().int(),
    stadium: z.string(),
    stadiumCapacity: z.number().int().positive(),
    city: z.string(),
    emails: z.array(z.object({ label: z.string(), address: z.string().email() })).min(1),
    phone: z.string(),
    socials: z.array(z.object({ platform: z.string(), url: z.string().url() })),
  }),
});

const season = defineCollection({
  loader: file('src/data/season.yaml'),
  schema: z.object({
    id: z.literal('current'),
    competition: z.string(),
    standingsUpdated: z.coerce.date(),
  }),
});

const teams = defineCollection({
  loader: file('src/data/teams.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    shortName: z.string().max(4),
    crest: z.string().startsWith('/images/teams/'),
  }),
});

const fixtures = defineCollection({
  loader: file('src/data/fixtures.yaml'),
  schema: z
    .object({
      id: z.string(),
      competition: z.string(),
      matchweek: z.number().int().positive().optional(),
      date: z.coerce.date(),
      venue: z.string(),
      home: reference('teams'),
      away: reference('teams'),
      status: z.enum(['scheduled', 'finished', 'postponed']),
      score: z
        .object({
          home: z.number().int().min(0),
          away: z.number().int().min(0),
        })
        .optional(),
      report: reference('news').optional(),
    })
    .refine((m) => (m.status === 'finished' ? m.score !== undefined : m.score === undefined), {
      message: 'A finished match requires a score; a scheduled or postponed match must not have one.',
      path: ['score'],
    })
    .refine((m) => m.home.id !== m.away.id, {
      message: 'A team cannot play itself.',
      path: ['away'],
    }),
});

const standings = defineCollection({
  loader: file('src/data/standings.yaml'),
  schema: z
    .object({
      id: z.string(),
      team: reference('teams'),
      won: z.number().int().min(0),
      drawn: z.number().int().min(0),
      lost: z.number().int().min(0),
      goalsFor: z.number().int().min(0),
      goalsAgainst: z.number().int().min(0),
    })
    .refine((row) => row.id === row.team.id, {
      message: 'A standings row id must equal its team slug.',
      path: ['id'],
    }),
});

const squad = defineCollection({
  loader: file('src/data/squad.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    number: z.number().int().min(1).max(99),
    position: z.enum(['Goalkeeper', 'Defender', 'Midfielder', 'Forward']),
    nationality: z.string().length(2),
    dateOfBirth: z.coerce.date(),
    heightCm: z.number().int().min(140).max(220),
    photo: z.string().startsWith('/images/squad/'),
    joined: z.number().int(),
    bio: z.string().optional(),
    stats: z
      .object({
        appearances: z.number().int().min(0),
        goals: z.number().int().min(0),
        assists: z.number().int().min(0),
      })
      .optional(),
  }),
});

const sponsors = defineCollection({
  loader: file('src/data/sponsors.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['main', 'official', 'partner']),
    logo: z.string().startsWith('/images/sponsors/'),
    url: z.string().url(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['match-report', 'club', 'transfer', 'academy']),
    excerpt: z.string().min(20).max(200),
    image: z.string().startsWith('/images/news/'),
    // Required, not optional: accessibility must not be droppable by omission.
    imageAlt: z.string().min(1),
    author: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { club, season, teams, fixtures, standings, squad, sponsors, news };
```

- [ ] **Step 2: Create the club and season data**

Create `src/data/club.yaml`:

```yaml
# PLACEHOLDER DATA. Founding year, stadium capacity and contact details
# are unverified and must be confirmed with the club before launch.
- id: club
  name: Kedah Football Association
  shortName: Kedah
  founded: 1924
  stadium: Darul Aman Stadium
  stadiumCapacity: 32387
  city: Alor Setar
  emails:
    - label: General enquiries
      address: enquiries@kedahfa.example
    - label: Media
      address: media@kedahfa.example
    - label: Commercial
      address: commercial@kedahfa.example
  phone: "+60 4-000 0000"
  socials:
    - platform: Facebook
      url: https://facebook.com/example
    - platform: Instagram
      url: https://instagram.com/example
    - platform: X
      url: https://x.com/example
```

Create `src/data/season.yaml`:

```yaml
- id: current
  competition: Super League 2026
  standingsUpdated: 2026-07-20
```

- [ ] **Step 3: Create the teams data**

Create `src/data/teams.yaml`:

```yaml
- id: kedah
  name: Kedah Football Association
  shortName: KDH
  crest: /images/teams/kedah.svg
- id: jdt
  name: Johor Darul Ta'zim
  shortName: JDT
  crest: /images/teams/jdt.svg
- id: selangor
  name: Selangor FC
  shortName: SEL
  crest: /images/teams/selangor.svg
- id: terengganu
  name: Terengganu FC
  shortName: TRG
  crest: /images/teams/terengganu.svg
- id: penang
  name: Penang FC
  shortName: PEN
  crest: /images/teams/penang.svg
- id: sabah
  name: Sabah FC
  shortName: SAB
  crest: /images/teams/sabah.svg
```

- [ ] **Step 4: Create the fixtures data**

Create `src/data/fixtures.yaml`. Weekdays below are verified: 19 Jul 2026 is a Sunday, 2 Aug 2026 is a Sunday, 15 Aug 2026 is a Saturday.

```yaml
# Finished matches carry a score. Scheduled and postponed matches must not.
- id: 2026-06-28-penang-a
  competition: Super League
  matchweek: 9
  date: 2026-06-28T20:15:00+08:00
  venue: Penang State Stadium
  home: penang
  away: kedah
  status: finished
  score: { home: 0, away: 2 }

- id: 2026-07-05-sabah-h
  competition: Super League
  matchweek: 10
  date: 2026-07-05T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah
  away: sabah
  status: finished
  score: { home: 1, away: 1 }

- id: 2026-07-19-selangor-h
  competition: Super League
  matchweek: 11
  date: 2026-07-19T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah
  away: selangor
  status: finished
  score: { home: 3, away: 2 }
  report: kedah-edge-selangor

- id: 2026-08-02-jdt-h
  competition: Super League
  matchweek: 12
  date: 2026-08-02T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah
  away: jdt
  status: scheduled

- id: 2026-08-15-terengganu-a
  competition: Super League
  matchweek: 13
  date: 2026-08-15T18:00:00+08:00
  venue: Sultan Mizan Zainal Abidin Stadium
  home: terengganu
  away: kedah
  status: scheduled

- id: 2026-08-29-penang-h
  competition: Malaysia Cup
  date: 2026-08-29T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah
  away: penang
  status: postponed
```

- [ ] **Step 5: Create the standings data**

Create `src/data/standings.yaml`. Only observations are stored — played, points and goal difference are derived in Task 3.

```yaml
- id: jdt
  team: jdt
  won: 9
  drawn: 2
  lost: 0
  goalsFor: 28
  goalsAgainst: 6
- id: kedah
  team: kedah
  won: 6
  drawn: 3
  lost: 2
  goalsFor: 19
  goalsAgainst: 11
- id: selangor
  team: selangor
  won: 6
  drawn: 3
  lost: 2
  goalsFor: 17
  goalsAgainst: 12
- id: terengganu
  team: terengganu
  won: 5
  drawn: 2
  lost: 4
  goalsFor: 15
  goalsAgainst: 14
- id: sabah
  team: sabah
  won: 3
  drawn: 4
  lost: 4
  goalsFor: 12
  goalsAgainst: 15
- id: penang
  team: penang
  won: 1
  drawn: 2
  lost: 8
  goalsFor: 7
  goalsAgainst: 24
```

Note: `kedah` and `selangor` are deliberately tied on points and goal difference is deliberately different, so Task 3's tie-break tests exercise real data.

- [ ] **Step 6: Create the squad data**

Create `src/data/squad.yaml`:

```yaml
# PLACEHOLDER SQUAD. Names are fictional; replace with the real squad before launch.
- id: arif-hakimi
  name: Arif Hakimi
  number: 1
  position: Goalkeeper
  nationality: MY
  dateOfBirth: 1995-03-11
  heightCm: 188
  photo: /images/squad/placeholder.svg
  joined: 2022
  bio: Shot-stopper who came through the state youth system and took the gloves in 2022.
  stats: { appearances: 11, goals: 0, assists: 0 }
- id: danial-syafiq
  name: Danial Syafiq
  number: 4
  position: Defender
  nationality: MY
  dateOfBirth: 1997-09-02
  heightCm: 183
  photo: /images/squad/placeholder.svg
  joined: 2023
  stats: { appearances: 11, goals: 1, assists: 0 }
- id: lucas-ferreira
  name: Lucas Ferreira
  number: 5
  position: Defender
  nationality: BR
  dateOfBirth: 1994-01-22
  heightCm: 190
  photo: /images/squad/placeholder.svg
  joined: 2025
  stats: { appearances: 10, goals: 2, assists: 1 }
- id: haziq-nadzri
  name: Haziq Nadzri
  number: 8
  position: Midfielder
  nationality: MY
  dateOfBirth: 1999-06-30
  heightCm: 175
  photo: /images/squad/placeholder.svg
  joined: 2021
  bio: Academy graduate and the side's metronome in midfield.
  stats: { appearances: 11, goals: 3, assists: 5 }
- id: kenji-watanabe
  name: Kenji Watanabe
  number: 10
  position: Midfielder
  nationality: JP
  dateOfBirth: 1996-11-14
  heightCm: 172
  photo: /images/squad/placeholder.svg
  joined: 2024
  stats: { appearances: 11, goals: 4, assists: 6 }
- id: firdaus-rahman
  name: Firdaus Rahman
  number: 9
  position: Forward
  nationality: MY
  dateOfBirth: 1998-04-12
  heightCm: 182
  photo: /images/squad/placeholder.svg
  joined: 2024
  bio: Top scorer in each of his first two seasons at Darul Aman.
  stats: { appearances: 11, goals: 7, assists: 3 }
- id: samuel-osei
  name: Samuel Osei
  number: 11
  position: Forward
  nationality: GH
  dateOfBirth: 1997-02-08
  heightCm: 186
  photo: /images/squad/placeholder.svg
  joined: 2025
  stats: { appearances: 9, goals: 2, assists: 2 }
```

- [ ] **Step 7: Create the sponsors data**

Create `src/data/sponsors.yaml`:

```yaml
- id: main-sponsor
  name: Placeholder Main Sponsor
  tier: main
  logo: /images/sponsors/placeholder.svg
  url: https://example.com
- id: kit-supplier
  name: Placeholder Kit Supplier
  tier: official
  logo: /images/sponsors/placeholder.svg
  url: https://example.com
- id: stadium-partner
  name: Placeholder Stadium Partner
  tier: official
  logo: /images/sponsors/placeholder.svg
  url: https://example.com
- id: community-partner
  name: Placeholder Community Partner
  tier: partner
  logo: /images/sponsors/placeholder.svg
  url: https://example.com
```

- [ ] **Step 8: Create three news articles**

Create `src/content/news/kedah-edge-selangor.md`:

```markdown
---
title: Kedah edge Selangor in five-goal thriller
date: 2026-07-19
category: match-report
excerpt: Two goals in eight second-half minutes turned a one-goal deficit into a win at Darul Aman.
image: /images/news/placeholder.svg
imageAlt: Players celebrating in front of the home stand at Darul Aman Stadium
author: Media Team
---

Kedah came from behind to beat Selangor 3-2 at Darul Aman Stadium, with two
goals in eight second-half minutes turning the match.

Firdaus Rahman opened the scoring inside twenty minutes before the visitors
replied twice before the break. The response after half time was immediate.

## Second-half turnaround

Kenji Watanabe levelled from the edge of the area, and Rahman completed the
comeback shortly after with his seventh of the season.
```

Create `src/content/news/academy-trials-open.md`:

```markdown
---
title: Academy trials open for the 2027 intake
date: 2026-07-12
category: academy
excerpt: Registration is open for under-15 and under-17 trials taking place across Kedah in September.
image: /images/news/placeholder.svg
imageAlt: Young players training on a grass pitch
author: Academy Team
---

The club has opened registration for its 2027 academy intake, with trials for
under-15 and under-17 age groups taking place across the state in September.

Sessions are open to players born between 2010 and 2013 who are resident in
Kedah. Places are limited and allocated on registration.
```

Create `src/content/news/new-signing-announced.md`:

```markdown
---
title: Samuel Osei joins on a two-year deal
date: 2026-06-30
category: transfer
excerpt: The Ghanaian forward arrives at Darul Aman on a two-year contract ahead of the second half of the season.
image: /images/news/placeholder.svg
imageAlt: A footballer holding a club scarf above his head
author: Media Team
---

Kedah have completed the signing of forward Samuel Osei on a two-year contract.

Osei joins ahead of the second half of the campaign and takes the number 11
shirt.
```

- [ ] **Step 9: Add the placeholder images**

Create the directories and simple placeholder SVGs so the paths referenced above resolve. Task 5 adds the check that enforces this.

```bash
mkdir -p public/images/{news,squad,teams,sponsors}

for f in public/images/news/placeholder.svg public/images/squad/placeholder.svg public/images/sponsors/placeholder.svg; do
  cat > "$f" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Placeholder">
  <rect width="160" height="160" fill="#16161A"/>
  <path d="M80 34a46 46 0 1 0 0 92 46 46 0 0 0 0-92Zm0 12 26 19-10 31H64l-10-31Z" fill="#26262C"/>
</svg>
SVG
done

for t in kedah jdt selangor terengganu penang sabah; do
  cat > "public/images/teams/$t.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="$t crest placeholder">
  <path d="M32 4 58 12v22c0 14-11 23-26 26C17 57 6 48 6 34V12Z" fill="#B3121B" stroke="#F2B705" stroke-width="3"/>
</svg>
SVG
done
```

- [ ] **Step 10: Verify the schemas accept the data**

```bash
npm run build
```

Expected: build succeeds. Astro validates every collection during the build.

- [ ] **Step 11: Verify a broken fixture fails the build**

This proves the refinements actually run — the whole reason for choosing Astro.

```bash
cp src/data/fixtures.yaml /tmp/fixtures.backup.yaml
# Give a scheduled match a score, which the refinement forbids.
printf '\n- id: 2026-09-05-broken\n  competition: Super League\n  date: 2026-09-05T20:45:00+08:00\n  venue: Darul Aman Stadium\n  home: kedah\n  away: sabah\n  status: scheduled\n  score: { home: 1, away: 0 }\n' >> src/data/fixtures.yaml
npm run build; echo "EXIT: $?"
```

Expected: build FAILS, non-zero exit, with the message "A finished match requires a score; a scheduled or postponed match must not have one."

If the build instead succeeds, Astro is not applying the top-level `.refine()`. In that case move both fixture refinements into `src/lib/validate.ts` as `assertFixtureInvariants()` and call it from `loadSiteData()` in Task 5, then re-run this check.

- [ ] **Step 12: Restore the good data and confirm the build passes**

```bash
cp /tmp/fixtures.backup.yaml src/data/fixtures.yaml
npm run build
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add content collection schemas and placeholder club data"
```

---

## Task 3: Standings derivation

**Files:**
- Create: `src/lib/standings.ts`
- Test: `tests/unit/standings.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module)
- Produces:
  - `interface StandingsInput { team: string; name: string; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number }`
  - `interface TableEntry extends StandingsInput { played: number; points: number; goalDifference: number; position: number }`
  - `deriveTable(rows: StandingsInput[]): TableEntry[]`
  - `tableSnippet(table: TableEntry[], clubSlug: string, limit: number): TableEntry[]`

- [ ] **Step 1: Write the failing standings tests**

Create `tests/unit/standings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveTable, tableSnippet, type StandingsInput } from '../../src/lib/standings';

function row(overrides: Partial<StandingsInput> & { team: string }): StandingsInput {
  return {
    name: overrides.team.toUpperCase(),
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...overrides,
  };
}

describe('deriveTable', () => {
  it('derives played, points and goal difference rather than trusting stored values', () => {
    const [entry] = deriveTable([
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2, goalsFor: 19, goalsAgainst: 11 }),
    ]);

    expect(entry.played).toBe(11);
    expect(entry.points).toBe(21);
    expect(entry.goalDifference).toBe(8);
  });

  it('handles a negative goal difference', () => {
    const [entry] = deriveTable([
      row({ team: 'penang', won: 1, drawn: 2, lost: 8, goalsFor: 7, goalsAgainst: 24 }),
    ]);

    expect(entry.goalDifference).toBe(-17);
    expect(entry.points).toBe(5);
  });

  it('orders by points descending and assigns positions from 1', () => {
    const table = deriveTable([
      row({ team: 'sabah', won: 3, drawn: 4, lost: 4 }),
      row({ team: 'jdt', won: 9, drawn: 2, lost: 0 }),
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['jdt', 'kedah', 'sabah']);
    expect(table.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it('breaks a points tie on goal difference', () => {
    const table = deriveTable([
      row({ team: 'selangor', won: 6, drawn: 3, lost: 2, goalsFor: 17, goalsAgainst: 12 }),
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2, goalsFor: 19, goalsAgainst: 11 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['kedah', 'selangor']);
  });

  it('breaks a goal-difference tie on goals scored', () => {
    const table = deriveTable([
      row({ team: 'alpha', won: 4, drawn: 0, lost: 0, goalsFor: 8, goalsAgainst: 4 }),
      row({ team: 'bravo', won: 4, drawn: 0, lost: 0, goalsFor: 12, goalsAgainst: 8 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['bravo', 'alpha']);
  });

  it('breaks a total tie alphabetically by name so the order is stable across builds', () => {
    const table = deriveTable([
      { ...row({ team: 'zulu' }), name: 'Zulu FC', won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 5 },
      { ...row({ team: 'alpha' }), name: 'Alpha FC', won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 5 },
    ]);

    expect(table.map((e) => e.team)).toEqual(['alpha', 'zulu']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ team: 'sabah', won: 1 }), row({ team: 'jdt', won: 9 })];
    deriveTable(rows);
    expect(rows.map((r) => r.team)).toEqual(['sabah', 'jdt']);
  });

  it('returns an empty table for no rows', () => {
    expect(deriveTable([])).toEqual([]);
  });
});

describe('tableSnippet', () => {
  const table = deriveTable([
    row({ team: 'jdt', won: 9, drawn: 2 }),
    row({ team: 'selangor', won: 7, drawn: 0 }),
    row({ team: 'terengganu', won: 6, drawn: 1 }),
    row({ team: 'sabah', won: 5, drawn: 2 }),
    row({ team: 'penang', won: 4, drawn: 1 }),
    row({ team: 'kedah', won: 2, drawn: 1 }),
  ]);

  it('returns the top N when the club is already inside them', () => {
    const snippet = tableSnippet(table, 'jdt', 3);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor', 'terengganu']);
  });

  it('appends the club row when the club sits outside the top N', () => {
    const snippet = tableSnippet(table, 'kedah', 3);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor', 'terengganu', 'kedah']);
  });

  it('never duplicates the club row', () => {
    const snippet = tableSnippet(table, 'selangor', 5);
    expect(snippet.filter((e) => e.team === 'selangor')).toHaveLength(1);
  });

  it('returns the whole table when the limit exceeds its length', () => {
    expect(tableSnippet(table, 'kedah', 50)).toHaveLength(6);
  });

  it('returns the top N unchanged when the club is not in the table at all', () => {
    const snippet = tableSnippet(table, 'unknown-club', 2);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "../../src/lib/standings"`.

- [ ] **Step 3: Implement the standings module**

Create `src/lib/standings.ts`:

```ts
/**
 * Only match observations are stored in standings.yaml. Played, points and
 * goal difference are derived here so a hand-edited table cannot contain
 * arithmetic that does not add up.
 */
export interface StandingsInput {
  team: string;
  name: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TableEntry extends StandingsInput {
  played: number;
  points: number;
  goalDifference: number;
  position: number;
}

const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;

export function deriveTable(rows: StandingsInput[]): TableEntry[] {
  return rows
    .map((row) => ({
      ...row,
      played: row.won + row.drawn + row.lost,
      points: row.won * POINTS_FOR_WIN + row.drawn * POINTS_FOR_DRAW,
      goalDifference: row.goalsFor - row.goalsAgainst,
      position: 0,
    }))
    // Sorts a fresh array, so the caller's input is untouched.
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        // Final tie-break keeps build output deterministic.
        a.name.localeCompare(b.name),
    )
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * The homepage shows the top of the table. If the club is not in that slice,
 * its row is appended so a supporter always sees where the side stands.
 */
export function tableSnippet(
  table: TableEntry[],
  clubSlug: string,
  limit: number,
): TableEntry[] {
  const top = table.slice(0, limit);
  if (top.some((entry) => entry.team === clubSlug)) return top;

  const clubRow = table.find((entry) => entry.team === clubSlug);
  return clubRow ? [...top, clubRow] : top;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS — 13 standings tests plus the 11 from Task 1.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: derive league table from stored match observations"
```

---

## Task 4: Fixture selection logic

**Files:**
- Create: `src/lib/fixtures.ts`
- Test: `tests/unit/fixtures.test.ts`

**Interfaces:**
- Consumes: `monthKey`, `formatMonthHeading` from `src/lib/dates.ts`
- Produces:
  - `type MatchStatus = 'scheduled' | 'finished' | 'postponed'`
  - `interface MatchScore { home: number; away: number }`
  - `interface Match { id: string; competition: string; matchweek?: number; date: Date; venue: string; home: string; away: string; status: MatchStatus; score?: MatchScore; report?: string }`
  - `upcomingMatches(all: Match[], now: Date): Match[]`
  - `finishedMatches(all: Match[]): Match[]`
  - `nextMatch(all: Match[], now: Date): Match | null`
  - `recentResults(all: Match[], limit: number): Match[]`
  - `type Hero = { kind: 'result' | 'fixture'; match: Match } | null`
  - `selectHero(all: Match[], now: Date): Hero`
  - `outcomeFor(match: Match, clubSlug: string): 'W' | 'D' | 'L' | null`
  - `groupByMonth(matches: Match[]): MonthGroup[]` where `interface MonthGroup { key: string; heading: string; matches: Match[] }`
  - `HERO_RESULT_WINDOW_DAYS: number`

- [ ] **Step 1: Write the failing fixture tests**

Create `tests/unit/fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  finishedMatches,
  groupByMonth,
  nextMatch,
  outcomeFor,
  recentResults,
  selectHero,
  upcomingMatches,
  type Match,
} from '../../src/lib/fixtures';

const CLUB = 'kedah';

// `date` is Omit-ted from Partial<Match> before intersecting: Match.date is a
// Date, and intersecting `date?: Date` with `date: string` resolves to `never`,
// which makes every call site a type error under strict mode.
function match(
  overrides: Omit<Partial<Match>, 'date'> & { id: string; date: string },
): Match {
  return {
    competition: 'Super League',
    venue: 'Darul Aman Stadium',
    home: CLUB,
    away: 'sabah',
    status: 'scheduled',
    ...overrides,
    date: new Date(overrides.date),
  };
}

const PENANG_AWAY_WIN = match({
  id: 'penang-a',
  date: '2026-06-28T20:15:00+08:00',
  home: 'penang',
  away: CLUB,
  status: 'finished',
  score: { home: 0, away: 2 },
});

const SABAH_HOME_DRAW = match({
  id: 'sabah-h',
  date: '2026-07-05T20:45:00+08:00',
  away: 'sabah',
  status: 'finished',
  score: { home: 1, away: 1 },
});

const SELANGOR_HOME_WIN = match({
  id: 'selangor-h',
  date: '2026-07-19T20:45:00+08:00',
  away: 'selangor',
  status: 'finished',
  score: { home: 3, away: 2 },
});

const JDT_HOME = match({ id: 'jdt-h', date: '2026-08-02T20:45:00+08:00', away: 'jdt' });

const TERENGGANU_AWAY = match({
  id: 'terengganu-a',
  date: '2026-08-15T18:00:00+08:00',
  home: 'terengganu',
  away: CLUB,
});

const POSTPONED_CUP = match({
  id: 'penang-cup',
  date: '2026-08-29T20:45:00+08:00',
  competition: 'Malaysia Cup',
  away: 'penang',
  status: 'postponed',
});

const ALL = [
  TERENGGANU_AWAY,
  PENANG_AWAY_WIN,
  POSTPONED_CUP,
  SELANGOR_HOME_WIN,
  JDT_HOME,
  SABAH_HOME_DRAW,
];

describe('upcomingMatches', () => {
  it('returns only future scheduled matches, soonest first', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).toEqual(['jdt-h', 'terengganu-a']);
  });

  it('excludes postponed matches even when their date is in the future', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).not.toContain('penang-cup');
  });

  it('drops a scheduled match once its kickoff has passed', () => {
    const now = new Date('2026-08-02T21:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).toEqual(['terengganu-a']);
  });
});

describe('finishedMatches', () => {
  it('returns finished matches most recent first', () => {
    expect(finishedMatches(ALL).map((m) => m.id)).toEqual(['selangor-h', 'sabah-h', 'penang-a']);
  });
});

describe('nextMatch', () => {
  it('returns the soonest upcoming match', () => {
    expect(nextMatch(ALL, new Date('2026-07-25T12:00:00+08:00'))?.id).toBe('jdt-h');
  });

  it('returns null when the season has no scheduled matches left', () => {
    expect(nextMatch(ALL, new Date('2026-12-01T12:00:00+08:00'))).toBeNull();
  });
});

describe('recentResults', () => {
  it('returns the most recent results up to the limit', () => {
    expect(recentResults(ALL, 2).map((m) => m.id)).toEqual(['selangor-h', 'sabah-h']);
  });

  it('returns everything available when fewer results exist than the limit', () => {
    expect(recentResults(ALL, 10)).toHaveLength(3);
  });
});

describe('outcomeFor', () => {
  it('reads a win from an away scoreline', () => {
    expect(outcomeFor(PENANG_AWAY_WIN, CLUB)).toBe('W');
  });

  it('reads a win from a home scoreline', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, CLUB)).toBe('W');
  });

  it('reads a draw', () => {
    expect(outcomeFor(SABAH_HOME_DRAW, CLUB)).toBe('D');
  });

  it('reads a loss from the opponent perspective', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, 'selangor')).toBe('L');
  });

  it('returns null for a match with no score', () => {
    expect(outcomeFor(JDT_HOME, CLUB)).toBeNull();
  });

  it('returns null for a club that did not play in the match', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, 'jdt')).toBeNull();
  });
});

describe('selectHero', () => {
  it('shows the latest result when it is within the five-day window', () => {
    const hero = selectHero(ALL, new Date('2026-07-21T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'result', match: SELANGOR_HOME_WIN });
  });

  it('shows the next fixture once the latest result is older than five days', () => {
    const hero = selectHero(ALL, new Date('2026-07-26T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'fixture', match: JDT_HOME });
  });

  it('still shows the result at exactly the window boundary', () => {
    // SELANGOR_HOME_WIN kicked off 2026-07-19T20:45+08:00, so this is 5.0 days
    // later to the second. The comparison is <=, so the result still wins.
    const exactlyFiveDays = new Date('2026-07-24T20:45:00+08:00');
    expect(selectHero(ALL, exactlyFiveDays)).toEqual({
      kind: 'result',
      match: SELANGOR_HOME_WIN,
    });
  });

  it('switches to the next fixture one minute past the boundary', () => {
    // Pins the off-by-one: with `<` instead of `<=` the previous test fails,
    // and with `<=` on a stale bound this one does.
    const justPast = new Date('2026-07-24T20:46:00+08:00');
    expect(selectHero(ALL, justPast)).toEqual({ kind: 'fixture', match: JDT_HOME });
  });

  it('falls back to the latest result when no fixtures remain', () => {
    const hero = selectHero(ALL, new Date('2026-12-01T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'result', match: SELANGOR_HOME_WIN });
  });

  it('returns null when there is no content at all', () => {
    expect(selectHero([], new Date('2026-07-26T09:00:00+08:00'))).toBeNull();
  });

  it('shows the next fixture when nothing has been played yet', () => {
    const hero = selectHero([JDT_HOME], new Date('2026-07-26T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'fixture', match: JDT_HOME });
  });
});

describe('groupByMonth', () => {
  it('groups matches under Kuala Lumpur month headings in chronological order', () => {
    const groups = groupByMonth([SELANGOR_HOME_WIN, JDT_HOME, PENANG_AWAY_WIN]);

    expect(groups.map((g) => g.heading)).toEqual(['June 2026', 'July 2026', 'August 2026']);
    expect(groups.map((g) => g.matches.length)).toEqual([1, 1, 1]);
  });

  it('places an after-midnight kickoff in its local month, not the UTC one', () => {
    // 00:30+08:00 on 1 September is 16:30 UTC on 31 August.
    const rollover = match({ id: 'rollover', date: '2026-09-01T00:30:00+08:00' });
    const [group] = groupByMonth([rollover]);

    expect(group.heading).toBe('September 2026');
    // The key is what actually groups matches. Asserting only the heading
    // would miss a raw getMonth() implementation: formatMonthHeading would
    // still print "September 2026" while the key silently said 2026-08.
    expect(group.key).toBe('2026-09');
  });

  it('does not merge two matches that share a UTC month but not a local one', () => {
    // Both of these are 31 August in UTC (15:00 and 16:30), but they fall in
    // different months in Kuala Lumpur. A UTC-based key collapses them into
    // one group; a correct key keeps them apart.
    const august = match({ id: 'aug', date: '2026-08-31T23:00:00+08:00' });
    const september = match({ id: 'sep', date: '2026-09-01T00:30:00+08:00' });

    const groups = groupByMonth([august, september]);

    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-09']);
    expect(groups.map((g) => g.matches.length)).toEqual([1, 1]);
  });

  it('returns an empty array for no matches', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "../../src/lib/fixtures"`.

- [ ] **Step 3: Implement the fixtures module**

Create `src/lib/fixtures.ts`:

```ts
import { formatMonthHeading, monthKey } from './dates';

export type MatchStatus = 'scheduled' | 'finished' | 'postponed';

export interface MatchScore {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  competition: string;
  matchweek?: number;
  date: Date;
  venue: string;
  home: string;
  away: string;
  status: MatchStatus;
  score?: MatchScore;
  report?: string;
}

/** How recent a result must be to outrank the next fixture on the homepage. */
export const HERO_RESULT_WINDOW_DAYS = 5;

const MS_PER_DAY = 86_400_000;

const byDateAscending = (a: Match, b: Match) => a.date.getTime() - b.date.getTime();
const byDateDescending = (a: Match, b: Match) => b.date.getTime() - a.date.getTime();

/**
 * Postponed matches are deliberately excluded: their stored date is stale,
 * so listing one as "upcoming" would advertise a kickoff that will not happen.
 */
export function upcomingMatches(all: Match[], now: Date): Match[] {
  return all
    .filter((m) => m.status === 'scheduled' && m.date.getTime() > now.getTime())
    .sort(byDateAscending);
}

export function finishedMatches(all: Match[]): Match[] {
  return all.filter((m) => m.status === 'finished').sort(byDateDescending);
}

export function nextMatch(all: Match[], now: Date): Match | null {
  return upcomingMatches(all, now)[0] ?? null;
}

export function recentResults(all: Match[], limit: number): Match[] {
  return finishedMatches(all).slice(0, limit);
}

export function outcomeFor(match: Match, clubSlug: string): 'W' | 'D' | 'L' | null {
  if (!match.score) return null;

  const scored =
    match.home === clubSlug
      ? match.score.home
      : match.away === clubSlug
        ? match.score.away
        : null;

  if (scored === null) return null;

  const conceded =
    match.home === clubSlug ? match.score.away : match.score.home;

  if (scored > conceded) return 'W';
  if (scored < conceded) return 'L';
  return 'D';
}

export type Hero = { kind: 'result' | 'fixture'; match: Match } | null;

/**
 * The hero reflects the club's current state: a fresh result while it is still
 * news, otherwise what is coming next, otherwise the last thing that happened.
 */
export function selectHero(all: Match[], now: Date): Hero {
  const latestResult = finishedMatches(all)[0] ?? null;

  if (latestResult) {
    const ageDays = (now.getTime() - latestResult.date.getTime()) / MS_PER_DAY;
    if (ageDays >= 0 && ageDays <= HERO_RESULT_WINDOW_DAYS) {
      return { kind: 'result', match: latestResult };
    }
  }

  const upcoming = nextMatch(all, now);
  if (upcoming) return { kind: 'fixture', match: upcoming };
  if (latestResult) return { kind: 'result', match: latestResult };
  return null;
}

export interface MonthGroup {
  key: string;
  heading: string;
  matches: Match[];
}

export function groupByMonth(matches: Match[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();

  for (const m of [...matches].sort(byDateAscending)) {
    const key = monthKey(m.date);
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(m);
    } else {
      groups.set(key, { key, heading: formatMonthHeading(m.date), matches: [m] });
    }
  }

  return [...groups.values()];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add fixture partitioning, hero selection and month grouping"
```

---

## Task 5: Cross-entry validation and the site data loader

Zod validates one entry at a time. Uniqueness and asset existence span entries, so they live here. `loadSiteData()` is the single choke point every page calls, which means these checks run on every build.

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/lib/squad.ts`
- Create: `src/lib/content.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/squad.test.ts`

**Interfaces:**
- Consumes: `Match` from `src/lib/fixtures.ts`, `StandingsInput` from `src/lib/standings.ts`
- Produces:
  - `assertUniqueSquadNumbers(players: { id: string; number: number }[]): void`
  - `assertUniqueIds(items: { id: string }[], label: string): void`
  - `assertPublicAssetsExist(paths: string[], publicDir: string): void`
  - `assertReferencesResolve(refs: Reference[], knownIds: Set<string>, label: string): void` where `interface Reference { from: string; field: string; id: string }`
  - `POSITIONS: readonly Position[]`, `type Position`, `interface Player`, `groupByPosition(players: Player[]): PositionGroup[]`
  - `loadSiteData(): Promise<SiteData>`

- [ ] **Step 1: Write the failing validation and squad tests**

Create `tests/unit/validate.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertPublicAssetsExist,
  assertReferencesResolve,
  assertUniqueIds,
  assertUniqueSquadNumbers,
} from '../../src/lib/validate';

describe('assertUniqueSquadNumbers', () => {
  it('accepts a squad with distinct numbers', () => {
    expect(() =>
      assertUniqueSquadNumbers([
        { id: 'a', number: 1 },
        { id: 'b', number: 9 },
      ]),
    ).not.toThrow();
  });

  it('throws naming both players and the duplicated number', () => {
    expect(() =>
      assertUniqueSquadNumbers([
        { id: 'firdaus-rahman', number: 9 },
        { id: 'samuel-osei', number: 9 },
      ]),
    ).toThrow(/9.*firdaus-rahman.*samuel-osei/s);
  });

  it('accepts an empty squad', () => {
    expect(() => assertUniqueSquadNumbers([])).not.toThrow();
  });
});

describe('assertUniqueIds', () => {
  it('accepts distinct ids', () => {
    expect(() => assertUniqueIds([{ id: 'jdt' }, { id: 'kedah' }], 'standings')).not.toThrow();
  });

  it('throws naming the collection and the repeated id', () => {
    expect(() => assertUniqueIds([{ id: 'jdt' }, { id: 'jdt' }], 'standings')).toThrow(
      /standings.*jdt/s,
    );
  });
});

describe('assertPublicAssetsExist', () => {
  function fixtureDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'kedah-assets-'));
    mkdirSync(join(dir, 'images', 'squad'), { recursive: true });
    writeFileSync(join(dir, 'images', 'squad', 'present.svg'), '<svg/>');
    return dir;
  }

  it('accepts paths that resolve inside the public directory', () => {
    expect(() =>
      assertPublicAssetsExist(['/images/squad/present.svg'], fixtureDir()),
    ).not.toThrow();
  });

  it('throws naming every missing asset', () => {
    expect(() =>
      assertPublicAssetsExist(
        ['/images/squad/present.svg', '/images/squad/gone.svg', '/images/news/also-gone.jpg'],
        fixtureDir(),
      ),
    ).toThrow(/gone\.svg[\s\S]*also-gone\.jpg/);
  });

  it('checks each distinct path once even when repeated', () => {
    expect(() =>
      assertPublicAssetsExist(
        ['/images/squad/gone.svg', '/images/squad/gone.svg'],
        fixtureDir(),
      ),
    ).toThrow(/gone\.svg/);
  });
});

describe('assertReferencesResolve', () => {
  const teams = new Set(['kedah', 'jdt', 'selangor']);

  it('accepts references whose targets all exist', () => {
    expect(() =>
      assertReferencesResolve(
        [
          { from: '2026-08-02-jdt-h', field: 'home', id: 'kedah' },
          { from: '2026-08-02-jdt-h', field: 'away', id: 'jdt' },
        ],
        teams,
        'teams',
      ),
    ).not.toThrow();
  });

  it('throws naming the entry, the field and the missing target', () => {
    expect(() =>
      assertReferencesResolve(
        [{ from: '2026-08-02-jdt-h', field: 'away', id: 'perak' }],
        teams,
        'teams',
      ),
    ).toThrow(/2026-08-02-jdt-h.*away.*perak/s);
  });

  it('reports every broken reference, not only the first', () => {
    expect(() =>
      assertReferencesResolve(
        [
          { from: 'fixture-a', field: 'home', id: 'ghost-one' },
          { from: 'fixture-b', field: 'report', id: 'ghost-two' },
        ],
        teams,
        'teams',
      ),
    ).toThrow(/ghost-one[\s\S]*ghost-two/);
  });

  it('accepts an empty reference list', () => {
    expect(() => assertReferencesResolve([], teams, 'teams')).not.toThrow();
  });
});
```

Create `tests/unit/squad.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupByPosition, type Player } from '../../src/lib/squad';

function player(overrides: Partial<Player> & { id: string; number: number; position: Player['position'] }): Player {
  return {
    name: overrides.id,
    nationality: 'MY',
    dateOfBirth: new Date('1998-01-01'),
    heightCm: 180,
    photo: '/images/squad/placeholder.svg',
    joined: 2024,
    ...overrides,
  };
}

describe('groupByPosition', () => {
  it('orders groups goalkeeper, defender, midfielder, forward', () => {
    const groups = groupByPosition([
      player({ id: 'f', number: 9, position: 'Forward' }),
      player({ id: 'g', number: 1, position: 'Goalkeeper' }),
      player({ id: 'm', number: 8, position: 'Midfielder' }),
      player({ id: 'd', number: 4, position: 'Defender' }),
    ]);

    expect(groups.map((g) => g.position)).toEqual([
      'Goalkeeper',
      'Defender',
      'Midfielder',
      'Forward',
    ]);
  });

  it('sorts players by squad number within a group', () => {
    const groups = groupByPosition([
      player({ id: 'eleven', number: 11, position: 'Forward' }),
      player({ id: 'nine', number: 9, position: 'Forward' }),
    ]);

    expect(groups[0].players.map((p) => p.number)).toEqual([9, 11]);
  });

  it('omits positions with no players rather than rendering empty sections', () => {
    const groups = groupByPosition([player({ id: 'g', number: 1, position: 'Goalkeeper' })]);
    expect(groups).toHaveLength(1);
  });

  it('returns an empty array for an empty squad', () => {
    expect(groupByPosition([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — cannot resolve `src/lib/validate` and `src/lib/squad`.

- [ ] **Step 3: Implement the validators**

Create `src/lib/validate.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Invariants that span multiple entries. Zod validates one record at a time,
 * so uniqueness and asset existence cannot live in the collection schemas.
 * Every function throws — called from loadSiteData(), a throw fails the build.
 */

export function assertUniqueSquadNumbers(players: { id: string; number: number }[]): void {
  const byNumber = new Map<number, string[]>();
  for (const player of players) {
    byNumber.set(player.number, [...(byNumber.get(player.number) ?? []), player.id]);
  }

  const clashes = [...byNumber.entries()].filter(([, ids]) => ids.length > 1);
  if (clashes.length === 0) return;

  const detail = clashes
    .map(([number, ids]) => `  ${number}: ${ids.join(', ')}`)
    .join('\n');
  throw new Error(`Duplicate squad numbers in src/data/squad.yaml:\n${detail}`);
}

export function assertUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }

  if (duplicates.size === 0) return;
  throw new Error(`Duplicate ${label} entries: ${[...duplicates].join(', ')}`);
}

export function assertPublicAssetsExist(paths: string[], publicDir: string): void {
  const missing = [...new Set(paths)].filter(
    (path) => !existsSync(join(publicDir, path.replace(/^\//, ''))),
  );

  if (missing.length === 0) return;
  throw new Error(
    `Referenced files are missing from public/:\n${missing.map((p) => `  ${p}`).join('\n')}`,
  );
}

export interface Reference {
  /** The id of the entry holding the reference, for the error message. */
  from: string;
  /** The field name holding the reference, e.g. "home" or "report". */
  field: string;
  /** The id being referenced. */
  id: string;
}

/**
 * Astro's reference() supplies typing and transforms a slug into
 * { collection, id }, but does NOT verify the target exists — a fixture naming
 * a team absent from teams.yaml builds clean. Verified against Astro 7.1.3.
 * This is the check that actually enforces referential integrity.
 */
export function assertReferencesResolve(
  refs: Reference[],
  knownIds: Set<string>,
  label: string,
): void {
  const broken = refs.filter((ref) => !knownIds.has(ref.id));
  if (broken.length === 0) return;

  const detail = broken
    .map((ref) => `  ${ref.from} → ${ref.field}: "${ref.id}"`)
    .join('\n');
  throw new Error(
    `References to unknown ${label} entries:\n${detail}\n` +
      `Known ${label}: ${[...knownIds].sort().join(', ')}`,
  );
}
```

- [ ] **Step 4: Implement the squad module**

Create `src/lib/squad.ts`:

```ts
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const;

export type Position = (typeof POSITIONS)[number];

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
  nationality: string;
  dateOfBirth: Date;
  heightCm: number;
  photo: string;
  joined: number;
  bio?: string;
  stats?: PlayerStats;
}

export interface PositionGroup {
  position: Position;
  players: Player[];
}

/** Groups in footballing order, shirt-number ascending, empty groups dropped. */
export function groupByPosition(players: Player[]): PositionGroup[] {
  return POSITIONS.map((position) => ({
    position,
    players: players
      .filter((p) => p.position === position)
      .sort((a, b) => a.number - b.number),
  })).filter((group) => group.players.length > 0);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Implement the site data loader**

Create `src/lib/content.ts`. This is the only module that bridges Astro collections and the pure libs.

```ts
import { getCollection, getEntry } from 'astro:content';
import type { Match } from './fixtures';
import type { StandingsInput } from './standings';
import type { Player, Position } from './squad';
import {
  assertPublicAssetsExist,
  assertReferencesResolve,
  assertUniqueIds,
  assertUniqueSquadNumbers,
} from './validate';

export const CLUB_SLUG = 'kedah';

const PUBLIC_DIR = new URL('../../public', import.meta.url).pathname;

export interface Team {
  id: string;
  name: string;
  shortName: string;
  crest: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'main' | 'official' | 'partner';
  logo: string;
  url: string;
}

export interface Article {
  slug: string;
  title: string;
  date: Date;
  category: 'match-report' | 'club' | 'transfer' | 'academy';
  excerpt: string;
  image: string;
  imageAlt: string;
  author: string;
}

export interface SiteData {
  club: {
    name: string;
    shortName: string;
    founded: number;
    stadium: string;
    stadiumCapacity: number;
    city: string;
    emails: { label: string; address: string }[];
    phone: string;
    socials: { platform: string; url: string }[];
  };
  season: { competition: string; standingsUpdated: Date };
  teams: Team[];
  teamsBySlug: Map<string, Team>;
  matches: Match[];
  standings: StandingsInput[];
  squad: Player[];
  sponsors: Sponsor[];
  articles: Article[];
}

let cached: Promise<SiteData> | null = null;

/**
 * Loads and validates every collection exactly once per build. Pages must call
 * this rather than getCollection() directly, so the cross-entry validators
 * below cannot be bypassed by adding a new page.
 */
export function loadSiteData(): Promise<SiteData> {
  cached ??= build();
  return cached;
}

async function build(): Promise<SiteData> {
  const clubEntry = await getEntry('club', 'club');
  const seasonEntry = await getEntry('season', 'current');
  if (!clubEntry) throw new Error('src/data/club.yaml is missing its "club" entry.');
  if (!seasonEntry) throw new Error('src/data/season.yaml is missing its "current" entry.');

  const [teamEntries, fixtureEntries, standingEntries, squadEntries, sponsorEntries, newsEntries] =
    await Promise.all([
      getCollection('teams'),
      getCollection('fixtures'),
      getCollection('standings'),
      getCollection('squad'),
      getCollection('sponsors'),
      getCollection('news', ({ data }) => import.meta.env.DEV || !data.draft),
    ]);

  const teams: Team[] = teamEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    shortName: e.data.shortName,
    crest: e.data.crest,
  }));

  const matches: Match[] = fixtureEntries.map((e) => ({
    id: e.id,
    competition: e.data.competition,
    matchweek: e.data.matchweek,
    date: e.data.date,
    venue: e.data.venue,
    home: e.data.home.id,
    away: e.data.away.id,
    status: e.data.status,
    score: e.data.score,
    report: e.data.report?.id,
  }));

  const teamsBySlug = new Map(teams.map((t) => [t.id, t]));

  const standings: StandingsInput[] = standingEntries.map((e) => ({
    team: e.data.team.id,
    name: teamsBySlug.get(e.data.team.id)?.name ?? e.data.team.id,
    won: e.data.won,
    drawn: e.data.drawn,
    lost: e.data.lost,
    goalsFor: e.data.goalsFor,
    goalsAgainst: e.data.goalsAgainst,
  }));

  const squad: Player[] = squadEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    number: e.data.number,
    position: e.data.position as Position,
    nationality: e.data.nationality,
    dateOfBirth: e.data.dateOfBirth,
    heightCm: e.data.heightCm,
    photo: e.data.photo,
    joined: e.data.joined,
    bio: e.data.bio,
    stats: e.data.stats,
  }));

  const sponsors: Sponsor[] = sponsorEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    tier: e.data.tier,
    logo: e.data.logo,
    url: e.data.url,
  }));

  const articles: Article[] = newsEntries
    .map((e) => ({
      slug: e.id,
      title: e.data.title,
      date: e.data.date,
      category: e.data.category,
      excerpt: e.data.excerpt,
      image: e.data.image,
      imageAlt: e.data.imageAlt,
      author: e.data.author,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  assertUniqueSquadNumbers(squad);
  assertUniqueIds(standingEntries, 'standings');
  assertUniqueIds(teamEntries, 'teams');

  // Astro's reference() does not check existence, so do it here — this is the
  // only place that holds every collection at once.
  const teamIds = new Set(teams.map((t) => t.id));
  assertReferencesResolve(
    [
      ...matches.flatMap((m) => [
        { from: m.id, field: 'home', id: m.home },
        { from: m.id, field: 'away', id: m.away },
      ]),
      ...standingEntries.map((e) => ({
        from: e.id,
        field: 'team',
        id: e.data.team.id,
      })),
    ],
    teamIds,
    'teams',
  );

  const articleIds = new Set(articles.map((a) => a.slug));
  assertReferencesResolve(
    matches
      .filter((m) => m.report)
      .map((m) => ({ from: m.id, field: 'report', id: m.report! })),
    articleIds,
    'news',
  );

  assertPublicAssetsExist(
    [
      ...teams.map((t) => t.crest),
      ...squad.map((p) => p.photo),
      ...sponsors.map((s) => s.logo),
      ...articles.map((a) => a.image),
    ],
    PUBLIC_DIR,
  );

  return {
    club: clubEntry.data,
    season: seasonEntry.data,
    teams,
    teamsBySlug,
    matches,
    standings,
    squad,
    sponsors,
    articles,
  };
}
```

- [ ] **Step 7: Verify a duplicate squad number fails the build**

```bash
cp src/data/squad.yaml /tmp/squad.backup.yaml
# Give Samuel Osei the number already worn by Firdaus Rahman.
sed -i '' 's/^  number: 11$/  number: 9/' src/data/squad.yaml
npm run build; echo "EXIT: $?"
```

Expected: build FAILS with "Duplicate squad numbers in src/data/squad.yaml" naming `9`, `firdaus-rahman` and `samuel-osei`.

Note: this only triggers once a page calls `loadSiteData()`. If the build passes because no page uses it yet, re-run this check at the end of Task 8 and treat it as that task's verification.

- [ ] **Step 8: Restore the good data**

```bash
cp /tmp/squad.backup.yaml src/data/squad.yaml
npm run build
```

Expected: PASS.

- [ ] **Step 9: Verify a dangling team reference is caught**

This is the check Astro's `reference()` does not perform. It must fail here.

```bash
cp src/data/fixtures.yaml /tmp/fixtures.backup.yaml
printf '\n- id: 2026-09-12-ghost\n  competition: Super League\n  date: 2026-09-12T20:45:00+08:00\n  venue: Darul Aman Stadium\n  home: kedah\n  away: perak\n  status: scheduled\n' >> src/data/fixtures.yaml
npm run build; echo "EXIT: $?"
cp /tmp/fixtures.backup.yaml src/data/fixtures.yaml
npm run build
```

Expected: the first build FAILS with `References to unknown teams entries:` naming
`2026-09-12-ghost → away: "perak"`; the second build PASSES.

Like Step 7, this only fires once a page calls `loadSiteData()`. If both builds
pass because no page uses it yet, re-run this check at the end of Task 8 and
treat it as that task's verification — but confirm now that
`npm test` covers `assertReferencesResolve` directly.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add cross-entry validators and single-choke-point site data loader"
```

---

## Task 6: Design tokens, base layout, header and footer

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro`
- Create: `src/components/islands/MobileNav.astro`
- Modify: `src/pages/index.astro` (temporary shell, replaced in Task 8)

**Interfaces:**
- Consumes: `loadSiteData` from `src/lib/content.ts`
- Produces: `BaseLayout.astro` with props `{ title: string; description: string; image?: string; imageAlt?: string }` and a default `<slot />`

- [ ] **Step 1: Install the self-hosted fonts**

```bash
npm install @fontsource-variable/inter @fontsource/barlow-condensed
```

Barlow Condensed has no variable build, so specific static weights are imported. Both packages bundle WOFF2 locally — no Google Fonts request.

- [ ] **Step 2: Write the brand tokens**

Create `src/styles/tokens.css`. This is the only file that changes at rebrand.

```css
/*
 * PLACEHOLDER BRANDING.
 * These are stand-in values, not verified Kedah FA colours. Replace the
 * palette and crest before launch. Nothing outside this file should contain
 * a raw hex colour.
 */
@theme {
  /* Brand */
  --color-club-red: #b3121b;
  --color-club-red-bright: #e0242e;
  --color-club-gold: #f2b705;

  /* Surfaces, darkest to lightest */
  --color-ink: #0b0b0d;
  --color-ink-raised: #131317;
  --color-ink-card: #1a1a20;
  --color-line: #2a2a32;

  /* Text — both meet WCAG AA on --color-ink */
  --color-text: #f4f4f5;
  --color-text-muted: #a8a8b3;

  /* Result semantics */
  --color-win: #2f9e5f;
  --color-draw: #8a8a96;
  --color-loss: #c2453c;

  /* Type */
  --font-display: 'Barlow Condensed', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;

  /* Layout */
  --spacing-gutter: 1.25rem;
  --radius-card: 2px;
}
```

- [ ] **Step 3: Write the global stylesheet**

Create `src/styles/global.css`:

```css
@import 'tailwindcss';
@import '@fontsource-variable/inter';
@import '@fontsource/barlow-condensed/600.css';
@import '@fontsource/barlow-condensed/700.css';
@import './tokens.css';

/*
 * Tailwind 4 auto-detects content sources across the repo. docs/ holds this
 * plan, whose code samples contain Tailwind classes for all 14 tasks — without
 * this exclusion the shipped CSS carries dead utilities for pages that do not
 * exist yet (measured: 75% larger). Exclude prose from the scan.
 */
@source not "../../docs";

@layer base {
  html {
    scroll-behavior: smooth;
    background-color: var(--color-ink);
    color: var(--color-text);
    font-family: var(--font-body);
    -webkit-text-size-adjust: 100%;
  }

  h1,
  h2,
  h3,
  .font-display {
    font-family: var(--font-display);
    text-transform: uppercase;
    letter-spacing: 0.01em;
    font-weight: 700;
  }

  /* Visible focus for keyboard users on a dark background. */
  :focus-visible {
    outline: 3px solid var(--color-club-gold);
    outline-offset: 2px;
  }

  /* Every interactive target clears the 44px minimum. */
  a,
  button {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  /* Inline links inside prose are exempt — they wrap with the text. */
  .prose a {
    min-height: 0;
    display: inline;
  }

  img {
    max-width: 100%;
    height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* The angular corner used on cards and the hero. */
@utility clip-corner {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 1.25rem), calc(100% - 1.25rem) 100%, 0 100%);
}
```

- [ ] **Step 4: Build the mobile navigation island**

Create `src/components/islands/MobileNav.astro`:

```astro
---
interface Props {
  links: { href: string; label: string }[];
}
const { links } = Astro.props;
---

<div class="md:hidden">
  <button
    type="button"
    id="nav-toggle"
    aria-expanded="false"
    aria-controls="mobile-nav"
    class="px-3 text-sm tracking-widest font-display"
  >
    Menu
  </button>

  <nav
    id="mobile-nav"
    hidden
    aria-label="Main navigation"
    class="absolute inset-x-0 top-full z-50 border-t border-[--color-line] bg-[--color-ink-raised]"
  >
    <ul class="flex flex-col p-2">
      {
        links.map((link) => (
          <li>
            <a href={link.href} class="w-full px-4 py-3 text-base font-display">
              {link.label}
            </a>
          </li>
        ))
      }
    </ul>
  </nav>
</div>

<script>
  const toggle = document.getElementById('nav-toggle');
  const panel = document.getElementById('mobile-nav');

  if (toggle && panel) {
    const setOpen = (open: boolean) => {
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Escape closes the panel and returns focus to the trigger.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
  }
</script>
```

- [ ] **Step 5: Build the site header**

Create `src/components/SiteHeader.astro`:

```astro
---
import MobileNav from './islands/MobileNav.astro';
import { loadSiteData } from '../lib/content';

const { club } = await loadSiteData();
const currentPath = Astro.url.pathname;

const links = [
  { href: '/news', label: 'News' },
  { href: '/squad', label: 'Squad' },
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/standings', label: 'Standings' },
  { href: '/club', label: 'Club' },
  { href: '/contact', label: 'Contact' },
];

const isCurrent = (href: string) => currentPath === href || currentPath.startsWith(`${href}/`);
---

<header class="relative border-b border-[--color-line] bg-[--color-ink-raised]">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-[--spacing-gutter] py-3">
    <a href="/" class="flex items-center gap-3" aria-label={`${club.name} home`}>
      <img src="/images/teams/kedah.svg" alt="" width="36" height="36" aria-hidden="true" />
      <span class="font-display text-lg leading-none">{club.shortName}</span>
    </a>

    <nav aria-label="Main navigation" class="hidden md:block">
      <ul class="flex items-center gap-1">
        {
          links.map((link) => (
            <li>
              <a
                href={link.href}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                class:list={[
                  'px-3 text-sm tracking-wider font-display',
                  isCurrent(link.href) ? 'text-[--color-club-gold]' : 'text-[--color-text]',
                ]}
              >
                {link.label}
              </a>
            </li>
          ))
        }
      </ul>
    </nav>

    <MobileNav links={links} />
  </div>
</header>
```

- [ ] **Step 6: Build the site footer**

Create `src/components/SiteFooter.astro`:

```astro
---
import { loadSiteData } from '../lib/content';

const { club } = await loadSiteData();
const year = new Date().getFullYear();
---

<footer class="mt-20 border-t border-[--color-line] bg-[--color-ink-raised]">
  <div class="mx-auto grid max-w-6xl gap-8 px-[--spacing-gutter] py-12 sm:grid-cols-3">
    <div>
      <h2 class="font-display text-base">{club.name}</h2>
      <p class="mt-2 text-sm text-[--color-text-muted]">
        {club.stadium}, {club.city}
      </p>
    </div>

    <div>
      <h2 class="font-display text-base">Contact</h2>
      <ul class="mt-2 space-y-1 text-sm">
        {
          club.emails.map((email) => (
            <li>
              <a href={`mailto:${email.address}`} class="text-[--color-text-muted] underline">
                {email.label}
              </a>
            </li>
          ))
        }
      </ul>
    </div>

    <div>
      <h2 class="font-display text-base">Follow</h2>
      <ul class="mt-2 space-y-1 text-sm">
        {
          club.socials.map((social) => (
            <li>
              <a href={social.url} rel="me noopener" class="text-[--color-text-muted] underline">
                {social.platform}
              </a>
            </li>
          ))
        }
      </ul>
    </div>
  </div>

  <div class="border-t border-[--color-line] px-[--spacing-gutter] py-4 text-center text-xs text-[--color-text-muted]">
    &copy; {year} {club.name}. All rights reserved.
  </div>
</footer>
```

- [ ] **Step 7: Build the base layout**

Create `src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/global.css';
import SiteHeader from '../components/SiteHeader.astro';
import SiteFooter from '../components/SiteFooter.astro';
import { loadSiteData } from '../lib/content';

interface Props {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}

const { title, description, image, imageAlt } = Astro.props;
const { club } = await loadSiteData();

const pageTitle = `${title} | ${club.name}`;
const canonical = new URL(Astro.url.pathname, Astro.site);
const socialImage = image ? new URL(image, Astro.site) : undefined;
---

<!doctype html>
<html lang="en-MY">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="alternate" type="application/rss+xml" title={`${club.name} news`} href="/rss.xml" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={canonical} />
    {socialImage && <meta property="og:image" content={socialImage} />}
    {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
    <meta name="twitter:card" content="summary_large_image" />
  </head>

  <body class="min-h-screen bg-[--color-ink] text-[--color-text] antialiased">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-[--color-club-gold] focus:px-4 focus:text-[--color-ink]"
    >
      Skip to content
    </a>

    <SiteHeader />

    <main id="main">
      <slot />
    </main>

    <SiteFooter />
  </body>
</html>
```

- [ ] **Step 8: Replace the placeholder homepage with a layout smoke test**

Replace `src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { loadSiteData } from '../lib/content';

const { club } = await loadSiteData();
---

<BaseLayout title="Home" description={`Official website of ${club.name}.`}>
  <div class="mx-auto max-w-6xl px-[--spacing-gutter] py-16">
    <h1 class="text-5xl">{club.name}</h1>
    <p class="mt-4 text-[--color-text-muted]">Homepage sections are built in Task 8.</p>
  </div>
</BaseLayout>
```

- [ ] **Step 9: Verify the build and inspect the result**

```bash
npm run build && npm run preview
```

Expected: build passes. Open the preview URL and confirm the header, footer and skip link render, and that the mobile menu opens and closes below 768px.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add brand tokens, base layout, header and footer"
```

---

## Task 7: Shared presentational components

**Files:**
- Create: `src/components/SectionHeading.astro`, `src/components/ArticleCard.astro`, `src/components/MatchRow.astro`, `src/components/PlayerCard.astro`, `src/components/StandingsTable.astro`, `src/components/SponsorGrid.astro`, `src/components/EmptyState.astro`
- Create: `src/components/islands/Countdown.astro`

**Interfaces:**
- Consumes: `Match`, `outcomeFor` from `src/lib/fixtures.ts`; `TableEntry` from `src/lib/standings.ts`; `Player` from `src/lib/squad.ts`; `Article`, `Team`, `Sponsor` from `src/lib/content.ts`; formatters from `src/lib/dates.ts`
- Produces:
  - `SectionHeading` — `{ title: string; href?: string; linkLabel?: string }`
  - `ArticleCard` — `{ article: Article; featured?: boolean }`
  - `MatchRow` — `{ match: Match; teamsBySlug: Map<string, Team>; clubSlug: string }`
  - `PlayerCard` — `{ player: Player }`
  - `StandingsTable` — `{ table: TableEntry[]; teamsBySlug: Map<string, Team>; clubSlug: string; compact?: boolean }`
  - `SponsorGrid` — `{ sponsors: Sponsor[] }`
  - `EmptyState` — `{ message: string }`
  - `Countdown` — `{ target: Date; label: string }`

- [ ] **Step 1: Build the small shared pieces**

Create `src/components/SectionHeading.astro`:

```astro
---
interface Props {
  title: string;
  href?: string;
  linkLabel?: string;
}
const { title, href, linkLabel = 'View all' } = Astro.props;
---

<div class="mb-6 flex items-end justify-between gap-4 border-b border-[--color-line] pb-3">
  <h2 class="text-2xl sm:text-3xl">{title}</h2>
  {
    href && (
      <a href={href} class="shrink-0 text-sm tracking-wider text-[--color-club-gold] font-display">
        {linkLabel}
      </a>
    )
  }
</div>
```

Create `src/components/EmptyState.astro`:

```astro
---
interface Props {
  message: string;
}
const { message } = Astro.props;
---

<p class="rounded-[--radius-card] border border-dashed border-[--color-line] px-6 py-10 text-center text-[--color-text-muted]">
  {message}
</p>
```

- [ ] **Step 2: Build the article card**

Create `src/components/ArticleCard.astro`:

```astro
---
import type { Article } from '../lib/content';
import { formatArticleDate } from '../lib/dates';

interface Props {
  article: Article;
  featured?: boolean;
}

const { article, featured = false } = Astro.props;

const CATEGORY_LABELS: Record<Article['category'], string> = {
  'match-report': 'Match Report',
  club: 'Club',
  transfer: 'Transfer',
  academy: 'Academy',
};
---

<article
  class:list={[
    'group clip-corner overflow-hidden bg-[--color-ink-card]',
    featured && 'sm:col-span-2 sm:row-span-2',
  ]}
  data-category={article.category}
>
  <a href={`/news/${article.slug}`} class="block h-full !min-h-0">
    <img
      src={article.image}
      alt={article.imageAlt}
      width={featured ? 800 : 400}
      height={featured ? 450 : 225}
      loading="lazy"
      decoding="async"
      class="aspect-video w-full object-cover"
    />

    <div class="p-4">
      <p class="text-xs tracking-widest text-[--color-club-gold] font-display">
        {CATEGORY_LABELS[article.category]}
      </p>
      <h3 class:list={['mt-2 leading-tight', featured ? 'text-2xl' : 'text-lg']}>
        {article.title}
      </h3>
      <p class="mt-2 text-sm text-[--color-text-muted]">{article.excerpt}</p>
      <p class="mt-3 text-xs text-[--color-text-muted]">
        <time datetime={article.date.toISOString()}>{formatArticleDate(article.date)}</time>
      </p>
    </div>
  </a>
</article>
```

- [ ] **Step 3: Build the match row**

Create `src/components/MatchRow.astro`:

```astro
---
import type { Team } from '../lib/content';
import { outcomeFor, type Match } from '../lib/fixtures';
import { formatKickoffTime, formatMatchDate } from '../lib/dates';

interface Props {
  match: Match;
  teamsBySlug: Map<string, Team>;
  clubSlug: string;
}

const { match, teamsBySlug, clubSlug } = Astro.props;

const home = teamsBySlug.get(match.home);
const away = teamsBySlug.get(match.away);
const outcome = outcomeFor(match, clubSlug);

const OUTCOME_STYLES: Record<string, string> = {
  W: 'bg-[--color-win]',
  D: 'bg-[--color-draw]',
  L: 'bg-[--color-loss]',
};

const OUTCOME_LABELS: Record<string, string> = { W: 'Win', D: 'Draw', L: 'Loss' };
---

<div
  class="clip-corner flex items-center gap-4 bg-[--color-ink-card] p-4"
  data-competition={match.competition}
>
  <div class="w-28 shrink-0 text-xs text-[--color-text-muted]">
    <p>{formatMatchDate(match.date)}</p>
    <p>
      {match.status === 'postponed' ? 'Postponed' : formatKickoffTime(match.date)}
    </p>
  </div>

  <div class="flex min-w-0 flex-1 items-center gap-3">
    <img src={home?.crest} alt="" width="28" height="28" aria-hidden="true" />
    <span class="truncate text-sm">{home?.name}</span>

    <span class="mx-auto shrink-0 px-2 text-lg font-display">
      {
        match.score
          ? `${match.score.home} - ${match.score.away}`
          : match.status === 'postponed'
            ? 'P-P'
            : 'v'
      }
    </span>

    <span class="truncate text-right text-sm">{away?.name}</span>
    <img src={away?.crest} alt="" width="28" height="28" aria-hidden="true" />
  </div>

  <div class="flex w-24 shrink-0 items-center justify-end gap-2">
    {
      outcome && (
        <span
          class:list={['h-6 w-6 items-center justify-center rounded-full text-xs flex', OUTCOME_STYLES[outcome]]}
        >
          <span class="sr-only">{OUTCOME_LABELS[outcome]}</span>
          <span aria-hidden="true">{outcome}</span>
        </span>
      )
    }
    {
      match.report && (
        <a href={`/news/${match.report}`} class="text-xs text-[--color-club-gold] underline">
          Report
        </a>
      )
    }
  </div>
</div>
```

- [ ] **Step 4: Build the player card**

Create `src/components/PlayerCard.astro`:

```astro
---
import type { Player } from '../lib/squad';

interface Props {
  player: Player;
}
const { player } = Astro.props;
---

<a
  href={`/squad/${player.id}`}
  class="clip-corner group relative block !min-h-0 overflow-hidden bg-[--color-ink-card]"
>
  <img
    src={player.photo}
    alt={`${player.name}, ${player.position}`}
    width="300"
    height="360"
    loading="lazy"
    decoding="async"
    class="aspect-[5/6] w-full object-cover"
  />

  <span
    aria-hidden="true"
    class="absolute right-2 top-1 text-6xl leading-none text-[--color-club-red] opacity-70 font-display"
  >
    {player.number}
  </span>

  <div class="p-3">
    <p class="text-xs tracking-widest text-[--color-text-muted] font-display">
      {player.position}
    </p>
    <p class="text-lg leading-tight font-display">{player.name}</p>
  </div>
</a>
```

- [ ] **Step 5: Build the standings table**

Create `src/components/StandingsTable.astro`:

```astro
---
import type { Team } from '../lib/content';
import type { TableEntry } from '../lib/standings';

interface Props {
  table: TableEntry[];
  teamsBySlug: Map<string, Team>;
  clubSlug: string;
  compact?: boolean;
}

const { table, teamsBySlug, clubSlug, compact = false } = Astro.props;
---

<div class="overflow-x-auto">
  <table class="w-full min-w-[32rem] border-collapse text-sm">
    <caption class="sr-only">League standings</caption>
    <thead>
      <tr class="border-b border-[--color-line] text-left text-xs tracking-widest text-[--color-text-muted] font-display">
        <th scope="col" class="py-2 pr-2">#</th>
        <th scope="col" class="py-2 pr-2">Team</th>
        <th scope="col" class="py-2 pr-2 text-center">P</th>
        {
          !compact && (
            <>
              <th scope="col" class="py-2 pr-2 text-center">W</th>
              <th scope="col" class="py-2 pr-2 text-center">D</th>
              <th scope="col" class="py-2 pr-2 text-center">L</th>
              <th scope="col" class="py-2 pr-2 text-center">GF</th>
              <th scope="col" class="py-2 pr-2 text-center">GA</th>
            </>
          )
        }
        <th scope="col" class="py-2 pr-2 text-center">GD</th>
        <th scope="col" class="py-2 text-center">Pts</th>
      </tr>
    </thead>

    <tbody>
      {
        table.map((entry) => (
          <tr
            class:list={[
              'border-b border-[--color-line]',
              // Bold weight, not just the tint: WCAG 1.4.1 forbids conveying
              // meaning by colour alone, and the sr-only marker below gives
              // screen reader users the same cue.
              entry.team === clubSlug && 'bg-[--color-club-red]/20 font-semibold',
            ]}
          >
            <td class="py-2 pr-2 text-[--color-text-muted]">{entry.position}</td>
            <th
              scope="row"
              class:list={[
                'py-2 pr-2 text-left',
                entry.team === clubSlug ? 'font-semibold' : 'font-normal',
              ]}
            >
              <span class="flex items-center gap-2">
                <img src={teamsBySlug.get(entry.team)?.crest} alt="" width="20" height="20" aria-hidden="true" />
                <span class="truncate">{entry.name}</span>
                {entry.team === clubSlug && <span class="sr-only">(your club)</span>}
              </span>
            </th>
            <td class="py-2 pr-2 text-center">{entry.played}</td>
            {!compact && (
              <>
                <td class="py-2 pr-2 text-center">{entry.won}</td>
                <td class="py-2 pr-2 text-center">{entry.drawn}</td>
                <td class="py-2 pr-2 text-center">{entry.lost}</td>
                <td class="py-2 pr-2 text-center">{entry.goalsFor}</td>
                <td class="py-2 pr-2 text-center">{entry.goalsAgainst}</td>
              </>
            )}
            <td class="py-2 pr-2 text-center">
              {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
            </td>
            <td class="py-2 text-center font-display">{entry.points}</td>
          </tr>
        ))
      }
    </tbody>
  </table>
</div>
```

- [ ] **Step 6: Build the sponsor grid**

Create `src/components/SponsorGrid.astro`:

```astro
---
import type { Sponsor } from '../lib/content';

interface Props {
  sponsors: Sponsor[];
}
const { sponsors } = Astro.props;

const TIER_LABELS = {
  main: 'Main Partner',
  official: 'Official Partners',
  partner: 'Club Partners',
} as const;

const tiers = (['main', 'official', 'partner'] as const)
  .map((tier) => ({ tier, items: sponsors.filter((s) => s.tier === tier) }))
  .filter((group) => group.items.length > 0);
---

<div class="space-y-8">
  {
    tiers.map((group) => (
      <div>
        <h3 class="mb-4 text-center text-xs tracking-[0.3em] text-[--color-text-muted] font-display">
          {TIER_LABELS[group.tier]}
        </h3>
        <ul class="flex flex-wrap items-center justify-center gap-8">
          {group.items.map((sponsor) => (
            <li>
              <a href={sponsor.url} rel="noopener sponsored" target="_blank">
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  width="120"
                  height="60"
                  loading="lazy"
                  class="h-12 w-auto opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    ))
  }
</div>
```

- [ ] **Step 7: Build the countdown island**

Create `src/components/islands/Countdown.astro`:

```astro
---
import { countdown } from '../../lib/dates';

interface Props {
  target: Date;
  label: string;
}

const { target, label } = Astro.props;

// Rendered at build time so the countdown is meaningful without JavaScript.
const initial = countdown(new Date(), target);
const units = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hrs' },
  { key: 'minutes', label: 'Min' },
  { key: 'seconds', label: 'Sec' },
] as const;
---

<div
  class:list={['countdown flex gap-3', !initial && 'font-display text-2xl']}
  data-target={target.toISOString()}
  role="timer"
  aria-label={label}
>
  {
    /*
     * A past target renders "Kick-off" server-side rather than 00 00 00 00.
     * Without this the no-JavaScript view of a stale build shows a countdown
     * of all zeros, which reads as broken rather than as "already started".
     */
    !initial && 'Kick-off'
  }
  {
    initial && units.map((unit) => (
      <div class="text-center">
        <span
          class="block text-3xl leading-none tabular-nums font-display"
          data-unit={unit.key}
        >
          {String(initial[unit.key]).padStart(2, '0')}
        </span>
        <span class="text-[0.65rem] tracking-widest text-[--color-text-muted]">
          {unit.label}
        </span>
      </div>
    ))
  }
</div>

<script>
  for (const root of document.querySelectorAll<HTMLElement>('.countdown')) {
    const target = new Date(root.dataset.target ?? '');
    if (Number.isNaN(target.getTime())) continue;

    const fields = {
      days: root.querySelector<HTMLElement>('[data-unit="days"]'),
      hours: root.querySelector<HTMLElement>('[data-unit="hours"]'),
      minutes: root.querySelector<HTMLElement>('[data-unit="minutes"]'),
      seconds: root.querySelector<HTMLElement>('[data-unit="seconds"]'),
    };

    const tick = () => {
      const remaining = target.getTime() - Date.now();

      if (remaining <= 0) {
        // Kickoff has passed. The static build still lists this as the next
        // match until the next deploy, so say so rather than counting down.
        root.textContent = 'Kick-off';
        root.classList.add('font-display', 'text-2xl');
        clearInterval(timer);
        return;
      }

      const total = Math.floor(remaining / 1000);
      const values = {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
      };

      for (const [key, element] of Object.entries(fields)) {
        if (element) {
          element.textContent = String(values[key as keyof typeof values]).padStart(2, '0');
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
  }
</script>
```

- [ ] **Step 8: Verify the build**

```bash
npm run build
```

Expected: PASS with 0 `astro check` errors. Components are unused until Task 8, so this only confirms they type-check.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add shared presentational components and countdown island"
```

---

## Task 8: Homepage

**Files:**
- Create: `src/components/HeroPanel.astro`, `src/components/NextMatchCard.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: everything from Tasks 5 and 7
- Produces: `HeroPanel` — `{ hero: Hero; teamsBySlug: Map<string, Team> }`; `NextMatchCard` — `{ match: Match; teamsBySlug: Map<string, Team> }`

- [ ] **Step 1: Build the hero panel**

Create `src/components/HeroPanel.astro`:

```astro
---
import type { Team } from '../lib/content';
import type { Hero } from '../lib/fixtures';
import { formatKickoffTime, formatMatchDate } from '../lib/dates';

interface Props {
  hero: Hero;
  teamsBySlug: Map<string, Team>;
}

const { hero, teamsBySlug } = Astro.props;
---

{
  hero && (
    <section class="relative isolate overflow-hidden bg-[--color-ink-raised]">
      <img
        src="/images/news/placeholder.svg"
        alt=""
        aria-hidden="true"
        width="1600"
        height="900"
        class="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
      />
      <div
        aria-hidden="true"
        class="absolute inset-0 -z-10 bg-gradient-to-t from-[--color-ink] via-[--color-ink]/70 to-transparent"
      />

      <div class="mx-auto max-w-6xl px-[--spacing-gutter] pb-12 pt-24 sm:pt-36">
        <p class="text-xs tracking-[0.3em] text-[--color-club-gold] font-display">
          {hero.kind === 'result' ? 'Latest Result' : 'Next Match'}
        </p>

        <h1 class="mt-3 text-4xl leading-none sm:text-6xl">
          {teamsBySlug.get(hero.match.home)?.shortName}
          <span class="mx-2 text-[--color-club-red-bright]">
            {hero.match.score ? `${hero.match.score.home} - ${hero.match.score.away}` : 'v'}
          </span>
          {teamsBySlug.get(hero.match.away)?.shortName}
        </h1>

        <p class="mt-3 text-sm text-[--color-text-muted]">
          {hero.match.competition} &middot; {formatMatchDate(hero.match.date)}
          {hero.kind === 'fixture' && ` · ${formatKickoffTime(hero.match.date)}`}
          &middot; {hero.match.venue}
        </p>

        {hero.match.report && (
          <a
            href={`/news/${hero.match.report}`}
            class="clip-corner mt-6 bg-[--color-club-red] px-6 text-sm tracking-widest text-white font-display"
          >
            Match Report
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Build the next-match card**

Create `src/components/NextMatchCard.astro`:

```astro
---
import Countdown from './islands/Countdown.astro';
import type { Team } from '../lib/content';
import type { Match } from '../lib/fixtures';
import { formatKickoffTime, formatMatchDate } from '../lib/dates';

interface Props {
  match: Match;
  teamsBySlug: Map<string, Team>;
}

const { match, teamsBySlug } = Astro.props;
const home = teamsBySlug.get(match.home);
const away = teamsBySlug.get(match.away);
---

<div class="clip-corner bg-[--color-ink-card] p-6 sm:p-8">
  <p class="text-xs tracking-[0.3em] text-[--color-club-gold] font-display">Next Match</p>

  <div class="mt-6 flex items-center justify-center gap-6 sm:gap-12">
    <div class="text-center">
      <img src={home?.crest} alt="" width="64" height="64" aria-hidden="true" class="mx-auto" />
      <p class="mt-2 text-sm font-display">{home?.name}</p>
    </div>

    <span class="text-2xl text-[--color-text-muted] font-display">v</span>

    <div class="text-center">
      <img src={away?.crest} alt="" width="64" height="64" aria-hidden="true" class="mx-auto" />
      <p class="mt-2 text-sm font-display">{away?.name}</p>
    </div>
  </div>

  <p class="mt-6 text-center text-sm text-[--color-text-muted]">
    {formatMatchDate(match.date)} &middot; {formatKickoffTime(match.date)} &middot; {match.venue}
  </p>

  <div class="mt-6 flex justify-center">
    <Countdown target={match.date} label={`Time until ${home?.name} versus ${away?.name}`} />
  </div>
</div>
```

- [ ] **Step 3: Assemble the homepage**

Replace `src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import ArticleCard from '../components/ArticleCard.astro';
import EmptyState from '../components/EmptyState.astro';
import HeroPanel from '../components/HeroPanel.astro';
import MatchRow from '../components/MatchRow.astro';
import NextMatchCard from '../components/NextMatchCard.astro';
import PlayerCard from '../components/PlayerCard.astro';
import SectionHeading from '../components/SectionHeading.astro';
import SponsorGrid from '../components/SponsorGrid.astro';
import StandingsTable from '../components/StandingsTable.astro';
import { CLUB_SLUG, loadSiteData } from '../lib/content';
import { nextMatch, recentResults, selectHero } from '../lib/fixtures';
import { deriveTable, tableSnippet } from '../lib/standings';
import { groupByPosition } from '../lib/squad';

const { club, teamsBySlug, matches, standings, squad, sponsors, articles } = await loadSiteData();

// Build time. The site must redeploy for these to advance — see the plan's
// operational note about the daily scheduled build.
const now = new Date();

const hero = selectHero(matches, now);
const upcoming = nextMatch(matches, now);
const results = recentResults(matches, 3);
const snippet = tableSnippet(deriveTable(standings), CLUB_SLUG, 5);
const featuredPlayers = groupByPosition(squad).flatMap((group) => group.players).slice(0, 6);
const latestArticles = articles.slice(0, 6);
---

<BaseLayout
  title="Home"
  description={`Official website of ${club.name}: news, fixtures, results, squad and standings.`}
>
  <HeroPanel hero={hero} teamsBySlug={teamsBySlug} />

  <div class="mx-auto max-w-6xl space-y-16 px-[--spacing-gutter] py-16">
    {upcoming && <NextMatchCard match={upcoming} teamsBySlug={teamsBySlug} />}

    <section>
      <SectionHeading title="Recent Results" href="/fixtures" />
      {
        results.length > 0 ? (
          <div class="space-y-3">
            {results.map((match) => (
              <MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
            ))}
          </div>
        ) : (
          <EmptyState message="No matches have been played yet this season." />
        )
      }
    </section>

    <section>
      <SectionHeading title="Standings" href="/standings" linkLabel="Full table" />
      {
        snippet.length > 0 ? (
          <StandingsTable
            table={snippet}
            teamsBySlug={teamsBySlug}
            clubSlug={CLUB_SLUG}
            compact
          />
        ) : (
          <EmptyState message="The league table will appear once the season is under way." />
        )
      }
    </section>

    <section>
      <SectionHeading title="Latest News" href="/news" />
      {
        latestArticles.length > 0 ? (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latestArticles.map((article, index) => (
              <ArticleCard article={article} featured={index === 0} />
            ))}
          </div>
        ) : (
          <EmptyState message="There is no club news to show yet." />
        )
      }
    </section>

    <section>
      <SectionHeading title="First Team" href="/squad" />
      {
        featuredPlayers.length > 0 ? (
          <ul class="-mx-[--spacing-gutter] flex snap-x gap-4 overflow-x-auto px-[--spacing-gutter] pb-2">
            {featuredPlayers.map((player) => (
              <li class="w-40 shrink-0 snap-start">
                <PlayerCard player={player} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="The squad list will be published shortly." />
        )
      }
    </section>

    {
      sponsors.length > 0 && (
        <section>
          <SectionHeading title="Partners" />
          <SponsorGrid sponsors={sponsors} />
        </section>
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 4: Build and inspect**

```bash
npm run build && npm run preview
```

Expected: build passes; homepage shows hero, next match with a live countdown, results, standings snippet with Kedah's row highlighted, six news cards, squad strip and sponsors.

- [ ] **Step 5: Verify the duplicate-squad-number check now fires**

The homepage calls `loadSiteData()`, so Task 5's validators run on every build. Confirm:

```bash
cp src/data/squad.yaml /tmp/squad.backup.yaml
sed -i '' 's/^  number: 11$/  number: 9/' src/data/squad.yaml
npm run build; echo "EXIT: $?"
cp /tmp/squad.backup.yaml src/data/squad.yaml
```

Expected: FAILS with "Duplicate squad numbers in src/data/squad.yaml", then restores.

- [ ] **Step 6: Verify the build passes again**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: build homepage with hero, next match, results, standings and news"
```

---

## Task 9: News index, articles, filtering and RSS

Pagination lives under `/news/page/N` rather than `/news/N`. A rest route at
`src/pages/news/[...page].astro` would sit beside `src/pages/news/[slug].astro`
and both would claim `/news/<something>`; separating them removes the ambiguity
entirely rather than relying on route-ranking rules.

**Files:**
- Create: `src/lib/pagination.ts`
- Create: `src/components/NewsList.astro`, `src/components/islands/CategoryFilter.astro`
- Create: `src/pages/news/index.astro`, `src/pages/news/page/[page].astro`, `src/pages/news/[slug].astro`, `src/pages/rss.xml.ts`
- Test: `tests/unit/pagination.test.ts`

**Interfaces:**
- Consumes: `loadSiteData`, `Article`, `ArticleCard`, `EmptyState`, `SectionHeading`
- Produces:
  - `NEWS_PAGE_SIZE: number`, `interface PageSlice<T> { items: T[]; currentPage: number; lastPage: number }`, `paginate<T>(all: T[], page: number, pageSize: number): PageSlice<T>`, `pageCount(total: number, pageSize: number): number`
  - `NewsList` — `{ articles: Article[]; currentPage: number; lastPage: number }`
  - routes `/news`, `/news/page/2`, `/news/<slug>`, `/rss.xml`

- [ ] **Step 1: Write the failing pagination tests**

Create `tests/unit/pagination.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NEWS_PAGE_SIZE, pageCount, paginate } from '../../src/lib/pagination';

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe('pageCount', () => {
  it('counts a partial final page', () => {
    expect(pageCount(25, 12)).toBe(3);
  });

  it('counts an exact multiple without adding an empty page', () => {
    expect(pageCount(24, 12)).toBe(2);
  });

  it('reports one page when there is nothing to show, so /news still exists', () => {
    expect(pageCount(0, 12)).toBe(1);
  });
});

describe('paginate', () => {
  it('returns the first slice', () => {
    const slice = paginate(items, 1, 12);
    expect(slice.items).toHaveLength(12);
    expect(slice.items[0]).toBe(1);
    expect(slice.currentPage).toBe(1);
    expect(slice.lastPage).toBe(3);
  });

  it('returns a middle slice', () => {
    expect(paginate(items, 2, 12).items[0]).toBe(13);
  });

  it('returns the short final slice', () => {
    expect(paginate(items, 3, 12).items).toEqual([25]);
  });

  it('clamps a page below the first', () => {
    expect(paginate(items, 0, 12).currentPage).toBe(1);
  });

  it('clamps a page beyond the last', () => {
    expect(paginate(items, 99, 12).currentPage).toBe(3);
  });

  it('handles an empty list without throwing', () => {
    expect(paginate([], 1, 12)).toEqual({ items: [], currentPage: 1, lastPage: 1 });
  });
});

describe('NEWS_PAGE_SIZE', () => {
  it('matches the spec of twelve articles per page', () => {
    expect(NEWS_PAGE_SIZE).toBe(12);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "../../src/lib/pagination"`.

- [ ] **Step 3: Implement the pagination module**

Create `src/lib/pagination.ts`:

```ts
export const NEWS_PAGE_SIZE = 12;

export interface PageSlice<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
}

/** Always at least 1, so /news renders an empty state rather than 404ing. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginate<T>(all: T[], page: number, pageSize: number): PageSlice<T> {
  const lastPage = pageCount(all.length, pageSize);
  const currentPage = Math.min(Math.max(page, 1), lastPage);
  const start = (currentPage - 1) * pageSize;

  return { items: all.slice(start, start + pageSize), currentPage, lastPage };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Build the category filter island**

Create `src/components/islands/CategoryFilter.astro`. It filters pre-rendered cards, so with JavaScript disabled every article stays visible.

```astro
---
interface Props {
  categories: { value: string; label: string }[];
  targetSelector: string;
  /** The data-* attribute on each item to match against, without the prefix. */
  filterKey: string;
}

const { categories, targetSelector, filterKey } = Astro.props;
---

<div
  class="filter mb-6 flex flex-wrap gap-2"
  data-target={targetSelector}
  data-key={filterKey}
>
  <button
    type="button"
    data-filter="all"
    aria-pressed="true"
    class="clip-corner bg-[--color-club-red] px-4 text-xs tracking-widest text-white font-display"
  >
    All
  </button>
  {
    categories.map((category) => (
      <button
        type="button"
        data-filter={category.value}
        aria-pressed="false"
        class="clip-corner bg-[--color-ink-card] px-4 text-xs tracking-widest text-[--color-text-muted] font-display"
      >
        {category.label}
      </button>
    ))
  }
</div>

<script>
  for (const bar of document.querySelectorAll<HTMLElement>('.filter')) {
    const selector = bar.dataset.target;
    const key = bar.dataset.key;
    if (!selector || !key) continue;

    const buttons = [...bar.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
    const items = [...document.querySelectorAll<HTMLElement>(selector)];

    const apply = (value: string) => {
      for (const button of buttons) {
        const active = button.dataset.filter === value;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('bg-[--color-club-red]', active);
        button.classList.toggle('text-white', active);
        button.classList.toggle('bg-[--color-ink-card]', !active);
        button.classList.toggle('text-[--color-text-muted]', !active);
      }

      for (const item of items) {
        item.hidden = value !== 'all' && item.dataset[key] !== value;
      }
    };

    for (const button of buttons) {
      button.addEventListener('click', () => apply(button.dataset.filter ?? 'all'));
    }
  }
</script>
```

- [ ] **Step 6: Build the shared news list component**

Both the first page and the numbered pages render the same list, so it lives in
one component.

Create `src/components/NewsList.astro`:

```astro
---
import ArticleCard from './ArticleCard.astro';
import CategoryFilter from './islands/CategoryFilter.astro';
import EmptyState from './EmptyState.astro';
import SectionHeading from './SectionHeading.astro';
import type { Article } from '../lib/content';

interface Props {
  articles: Article[];
  currentPage: number;
  lastPage: number;
}

const { articles, currentPage, lastPage } = Astro.props;

const CATEGORIES = [
  { value: 'match-report', label: 'Match Reports' },
  { value: 'club', label: 'Club' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'academy', label: 'Academy' },
];

// Page 1 lives at /news, not /news/page/1.
const previousUrl =
  currentPage <= 1 ? null : currentPage === 2 ? '/news' : `/news/page/${currentPage - 1}`;
const nextUrl = currentPage < lastPage ? `/news/page/${currentPage + 1}` : null;
---

<div class="mx-auto max-w-6xl px-[--spacing-gutter] py-12">
  <SectionHeading title="News" />

  {
    articles.length > 0 && (
      <CategoryFilter categories={CATEGORIES} targetSelector="[data-category]" filterKey="category" />
    )
  }

  {
    articles.length > 0 ? (
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard article={article} />
        ))}
      </div>
    ) : (
      <EmptyState message="There is no club news to show yet." />
    )
  }

  {
    lastPage > 1 && (
      <nav class="mt-10 flex items-center justify-between" aria-label="Pagination">
        {previousUrl ? (
          <a href={previousUrl} class="text-sm text-[--color-club-gold] font-display">
            &larr; Newer
          </a>
        ) : (
          <span />
        )}

        <p class="text-sm text-[--color-text-muted]">
          Page {currentPage} of {lastPage}
        </p>

        {nextUrl ? (
          <a href={nextUrl} class="text-sm text-[--color-club-gold] font-display">
            Older &rarr;
          </a>
        ) : (
          <span />
        )}
      </nav>
    )
  }
</div>
```

Note: the filter narrows the current page only — it does not re-paginate. That
is the documented behaviour in the spec.

- [ ] **Step 7: Build the news index (page 1)**

Create `src/pages/news/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import NewsList from '../../components/NewsList.astro';
import { loadSiteData } from '../../lib/content';
import { NEWS_PAGE_SIZE, paginate } from '../../lib/pagination';

const { articles } = await loadSiteData();
const page = paginate(articles, 1, NEWS_PAGE_SIZE);
---

<BaseLayout title="News" description="The latest news, match reports and announcements.">
  <NewsList articles={page.items} currentPage={page.currentPage} lastPage={page.lastPage} />
</BaseLayout>
```

- [ ] **Step 8: Build the numbered news pages**

Create `src/pages/news/page/[page].astro`. Page 1 is deliberately excluded so
`/news` is the only URL for the first page — no duplicate content.

```astro
---
import type { GetStaticPaths } from 'astro';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import NewsList from '../../../components/NewsList.astro';
import { loadSiteData } from '../../../lib/content';
import { NEWS_PAGE_SIZE, pageCount, paginate } from '../../../lib/pagination';

export const getStaticPaths = (async () => {
  const { articles } = await loadSiteData();
  const last = pageCount(articles.length, NEWS_PAGE_SIZE);

  return Array.from({ length: Math.max(0, last - 1) }, (_, index) => ({
    params: { page: String(index + 2) },
  }));
}) satisfies GetStaticPaths;

const { articles } = await loadSiteData();
const page = paginate(articles, Number(Astro.params.page), NEWS_PAGE_SIZE);
---

<BaseLayout
  title={`News — page ${page.currentPage}`}
  description="The latest news, match reports and announcements."
>
  <NewsList articles={page.items} currentPage={page.currentPage} lastPage={page.lastPage} />
</BaseLayout>
```

With the three placeholder articles this generates no numbered pages, which is
correct — `getStaticPaths` returning an empty array is valid.

- [ ] **Step 9: Build the article page**

Create `src/pages/news/[slug].astro`:

```astro
---
import type { GetStaticPaths } from 'astro';
import { getCollection, getEntry, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { formatArticleDate } from '../../lib/dates';

export const getStaticPaths = (async () => {
  const articles = await getCollection('news', ({ data }) => import.meta.env.DEV || !data.draft);
  return articles.map((article) => ({ params: { slug: article.id } }));
}) satisfies GetStaticPaths;

const { slug } = Astro.params;
const article = await getEntry('news', slug!);

// getStaticPaths only emits slugs that exist, so a miss is a build-time bug,
// not a visitor reaching a bad URL. Throwing fails the build; Astro.redirect
// would be meaningless in a static render.
if (!article) throw new Error(`No news article for slug "${slug}".`);

const { Content } = await render(article);
---

<BaseLayout
  title={article.data.title}
  description={article.data.excerpt}
  image={article.data.image}
  imageAlt={article.data.imageAlt}
>
  <article class="mx-auto max-w-3xl px-[--spacing-gutter] py-12">
    <p class="text-xs tracking-widest text-[--color-club-gold] font-display">
      {article.data.category.replace('-', ' ')}
    </p>

    <h1 class="mt-3 text-4xl leading-tight sm:text-5xl">{article.data.title}</h1>

    <p class="mt-4 text-sm text-[--color-text-muted]">
      <time datetime={article.data.date.toISOString()}>
        {formatArticleDate(article.data.date)}
      </time>
      &middot; {article.data.author}
    </p>

    <img
      src={article.data.image}
      alt={article.data.imageAlt}
      width="960"
      height="540"
      class="clip-corner mt-8 aspect-video w-full object-cover"
    />

    <div
      class="prose prose-invert mt-8 max-w-none prose-headings:font-display prose-headings:uppercase prose-a:text-[--color-club-gold]"
    >
      <Content />
    </div>

    <a href="/news" class="mt-10 text-sm text-[--color-club-gold] font-display">
      &larr; All news
    </a>
  </article>
</BaseLayout>
```

- [ ] **Step 10: Add the typography plugin**

The article body uses `prose` classes.

```bash
npm install -D @tailwindcss/typography
```

Add `@plugin` to `src/styles/global.css` **after all four `@import` lines**, not
between them — a non-import rule in the middle of the import block is invalid
CSS and some tooling will drop everything after it. The top of the file becomes:

```css
@import 'tailwindcss';
@import '@fontsource-variable/inter';
@import '@fontsource/barlow-condensed/600.css';
@import '@fontsource/barlow-condensed/700.css';
@import './tokens.css';

@plugin '@tailwindcss/typography';
```

- [ ] **Step 11: Build the RSS feed**

Create `src/pages/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadSiteData } from '../lib/content';

export async function GET(context: APIContext) {
  const { club, articles } = await loadSiteData();

  return rss({
    title: `${club.name} news`,
    description: `The latest news and match reports from ${club.name}.`,
    site: context.site!,
    items: articles.map((article) => ({
      title: article.title,
      description: article.excerpt,
      pubDate: article.date,
      link: `/news/${article.slug}`,
    })),
  });
}
```

- [ ] **Step 12: Verify the routes build and render**

```bash
npm run build
ls dist/news
test -f dist/rss.xml && echo "RSS OK"
```

Expected: `dist/news/index.html` plus one directory per article, and no
`dist/news/page/` directory while there are fewer than 13 articles; "RSS OK".

- [ ] **Step 13: Confirm the no-JavaScript baseline**

```bash
npm run preview
```

In the browser, disable JavaScript and load `/news`. Expected: every article card is visible and readable; only the filter buttons are inert.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add news index, article pages, category filter and RSS feed"
```

---

## Task 10: Squad and player profiles

**Files:**
- Create: `src/pages/squad/index.astro`, `src/pages/squad/[slug].astro`

**Interfaces:**
- Consumes: `loadSiteData`, `groupByPosition`, `PlayerCard`, `EmptyState`
- Produces: routes `/squad`, `/squad/<slug>`

- [ ] **Step 1: Build the squad index**

Create `src/pages/squad/index.astro`:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import EmptyState from '../../components/EmptyState.astro';
import PlayerCard from '../../components/PlayerCard.astro';
import SectionHeading from '../../components/SectionHeading.astro';
import { loadSiteData } from '../../lib/content';
import { groupByPosition } from '../../lib/squad';

const { club, squad } = await loadSiteData();
const groups = groupByPosition(squad);
---

<BaseLayout title="Squad" description={`The ${club.name} first-team squad.`}>
  <div class="mx-auto max-w-6xl space-y-12 px-[--spacing-gutter] py-12">
    <SectionHeading title="First Team Squad" />

    {
      groups.length > 0 ? (
        groups.map((group) => (
          <section>
            <h2 class="mb-4 text-sm tracking-[0.3em] text-[--color-club-gold]">
              {group.position}s
            </h2>
            <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {group.players.map((player) => (
                <li>
                  <PlayerCard player={player} />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState message="The squad list will be published shortly." />
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 2: Build the player profile**

Create `src/pages/squad/[slug].astro`:

```astro
---
import type { GetStaticPaths } from 'astro';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { formatArticleDate } from '../../lib/dates';
import { loadSiteData } from '../../lib/content';

export const getStaticPaths = (async () => {
  const { squad } = await loadSiteData();
  return squad.map((player) => ({ params: { slug: player.id }, props: { player } }));
}) satisfies GetStaticPaths;

const { player } = Astro.props;

const details = [
  { label: 'Squad number', value: String(player.number) },
  { label: 'Position', value: player.position },
  { label: 'Nationality', value: player.nationality },
  { label: 'Date of birth', value: formatArticleDate(player.dateOfBirth) },
  { label: 'Height', value: `${player.heightCm} cm` },
  { label: 'Joined', value: String(player.joined) },
];
---

<BaseLayout
  title={player.name}
  description={`${player.name}, ${player.position.toLowerCase()} for the first team.`}
  image={player.photo}
  imageAlt={`${player.name}, ${player.position}`}
>
  <div class="mx-auto max-w-5xl px-[--spacing-gutter] py-12">
    <a href="/squad" class="text-sm text-[--color-club-gold] font-display">&larr; Squad</a>

    <div class="mt-6 grid gap-8 sm:grid-cols-[300px_1fr]">
      <img
        src={player.photo}
        alt={`${player.name}, ${player.position}`}
        width="300"
        height="360"
        class="clip-corner aspect-[5/6] w-full bg-[--color-ink-card] object-cover"
      />

      <div>
        <p class="text-6xl leading-none text-[--color-club-red] font-display">
          {player.number}
        </p>
        <h1 class="mt-2 text-4xl leading-tight">{player.name}</h1>
        <p class="mt-1 text-sm tracking-widest text-[--color-club-gold] font-display">
          {player.position}
        </p>

        {player.bio && <p class="mt-6 text-[--color-text-muted]">{player.bio}</p>}

        <dl class="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {
            details.map((detail) => (
              <div class="border-b border-[--color-line] pb-2">
                <dt class="text-xs tracking-widest text-[--color-text-muted] font-display">
                  {detail.label}
                </dt>
                <dd class="mt-1">{detail.value}</dd>
              </div>
            ))
          }
        </dl>

        {
          player.stats && (
            <div class="mt-8">
              <h2 class="text-sm tracking-[0.3em] text-[--color-club-gold]">Season Stats</h2>
              <dl class="mt-4 flex gap-8">
                <div>
                  <dd class="text-3xl font-display">{player.stats.appearances}</dd>
                  <dt class="text-xs tracking-widest text-[--color-text-muted]">Apps</dt>
                </div>
                <div>
                  <dd class="text-3xl font-display">{player.stats.goals}</dd>
                  <dt class="text-xs tracking-widest text-[--color-text-muted]">Goals</dt>
                </div>
                <div>
                  <dd class="text-3xl font-display">{player.stats.assists}</dd>
                  <dt class="text-xs tracking-widest text-[--color-text-muted]">Assists</dt>
                </div>
              </dl>
            </div>
          )
        }
      </div>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Verify the routes build**

```bash
npm run build
ls dist/squad
```

Expected: `index.html` plus one directory per player (7 with the placeholder squad).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add squad index and player profile pages"
```

---

## Task 11: Fixtures and standings pages

**Files:**
- Create: `src/pages/fixtures.astro`, `src/pages/standings.astro`

**Interfaces:**
- Consumes: `loadSiteData`, `groupByMonth`, `upcomingMatches`, `finishedMatches`, `deriveTable`, `MatchRow`, `StandingsTable`, `CategoryFilter`
- Produces: routes `/fixtures`, `/standings`

- [ ] **Step 1: Build the fixtures page**

Create `src/pages/fixtures.astro`. Postponed matches are listed in their own section so they are visible without polluting the upcoming list.

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import CategoryFilter from '../components/islands/CategoryFilter.astro';
import EmptyState from '../components/EmptyState.astro';
import MatchRow from '../components/MatchRow.astro';
import SectionHeading from '../components/SectionHeading.astro';
import { CLUB_SLUG, loadSiteData } from '../lib/content';
import { finishedMatches, groupByMonth, upcomingMatches } from '../lib/fixtures';

const { club, matches, teamsBySlug } = await loadSiteData();

const now = new Date();
const upcoming = groupByMonth(upcomingMatches(matches, now));
const results = groupByMonth(finishedMatches(matches)).reverse();
const postponed = matches.filter((m) => m.status === 'postponed');

const competitions = [...new Set(matches.map((m) => m.competition))].map((competition) => ({
  value: competition,
  label: competition,
}));
---

<BaseLayout
  title="Fixtures & Results"
  description={`Every ${club.shortName} fixture and result this season.`}
>
  <div class="mx-auto max-w-4xl space-y-14 px-[--spacing-gutter] py-12">
    <SectionHeading title="Fixtures & Results" />

    {
      competitions.length > 1 && (
        <CategoryFilter
          categories={competitions}
          targetSelector="[data-competition]"
          filterKey="competition"
        />
      )
    }

    <section>
      <h2 class="mb-4 text-sm tracking-[0.3em] text-[--color-club-gold]">Upcoming</h2>
      {
        upcoming.length > 0 ? (
          upcoming.map((group) => (
            <div class="mb-8">
              <h3 class="mb-3 text-lg text-[--color-text-muted]">{group.heading}</h3>
              <div class="space-y-3">
                {group.matches.map((match) => (
                  <MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="No fixtures are currently scheduled." />
        )
      }
    </section>

    {
      postponed.length > 0 && (
        <section>
          <h2 class="mb-4 text-sm tracking-[0.3em] text-[--color-club-gold]">Postponed</h2>
          <div class="space-y-3">
            {postponed.map((match) => (
              <MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
            ))}
          </div>
        </section>
      )
    }

    <section>
      <h2 class="mb-4 text-sm tracking-[0.3em] text-[--color-club-gold]">Results</h2>
      {
        results.length > 0 ? (
          results.map((group) => (
            <div class="mb-8">
              <h3 class="mb-3 text-lg text-[--color-text-muted]">{group.heading}</h3>
              <div class="space-y-3">
                {group.matches.map((match) => (
                  <MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="No matches have been played yet this season." />
        )
      }
    </section>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Build the standings page**

Create `src/pages/standings.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EmptyState from '../components/EmptyState.astro';
import SectionHeading from '../components/SectionHeading.astro';
import StandingsTable from '../components/StandingsTable.astro';
import { CLUB_SLUG, loadSiteData } from '../lib/content';
import { formatArticleDate } from '../lib/dates';
import { deriveTable } from '../lib/standings';

const { season, standings, teamsBySlug } = await loadSiteData();
const table = deriveTable(standings);
---

<BaseLayout title="Standings" description={`${season.competition} league table.`}>
  <div class="mx-auto max-w-4xl px-[--spacing-gutter] py-12">
    <SectionHeading title={season.competition} />

    {
      table.length > 0 ? (
        <>
          <StandingsTable table={table} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
          <p class="mt-4 text-xs text-[--color-text-muted]">
            Last updated{' '}
            <time datetime={season.standingsUpdated.toISOString()}>
              {formatArticleDate(season.standingsUpdated)}
            </time>
            . Points, played and goal difference are calculated from results.
          </p>
        </>
      ) : (
        <EmptyState message="The league table will appear once the season is under way." />
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 3: Verify both pages build and render correctly**

```bash
npm run build && npm run preview
```

Expected: `/fixtures` shows upcoming grouped by month ascending, a Postponed section containing the Malaysia Cup tie, and results grouped most-recent-month-first. `/standings` shows all six teams with Kedah second on goal difference ahead of Selangor.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add fixtures and standings pages"
```

---

## Task 12: Club, contact, 404 and robots

**Files:**
- Create: `src/pages/club.astro`, `src/pages/contact.astro`, `src/pages/404.astro`
- Create: `public/robots.txt`

**Interfaces:**
- Consumes: `loadSiteData`, `SponsorGrid`, `SectionHeading`
- Produces: routes `/club`, `/contact`, `/404`, `/robots.txt`

- [ ] **Step 1: Build the club page**

Create `src/pages/club.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SectionHeading from '../components/SectionHeading.astro';
import SponsorGrid from '../components/SponsorGrid.astro';
import { loadSiteData } from '../lib/content';

const { club, sponsors } = await loadSiteData();

const facts = [
  { label: 'Founded', value: String(club.founded) },
  { label: 'Stadium', value: club.stadium },
  { label: 'Capacity', value: club.stadiumCapacity.toLocaleString('en-GB') },
  { label: 'City', value: club.city },
];
---

<BaseLayout title="The Club" description={`About ${club.name}.`}>
  <div class="mx-auto max-w-4xl space-y-12 px-[--spacing-gutter] py-12">
    <SectionHeading title="The Club" />

    <p class="text-lg text-[--color-text-muted]">
      {club.name} is based at {club.stadium} in {club.city} and has represented the
      state since {club.founded}.
    </p>

    <dl class="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {
        facts.map((fact) => (
          <div class="clip-corner bg-[--color-ink-card] p-4">
            <dt class="text-xs tracking-widest text-[--color-text-muted] font-display">
              {fact.label}
            </dt>
            <dd class="mt-1 text-2xl font-display">{fact.value}</dd>
          </div>
        ))
      }
    </dl>

    {
      sponsors.length > 0 && (
        <section>
          <SectionHeading title="Partners" />
          <SponsorGrid sponsors={sponsors} />
        </section>
      )
    }
  </div>
</BaseLayout>
```

- [ ] **Step 2: Build the contact page**

Create `src/pages/contact.astro`. No form — the site is static with no backend to receive submissions.

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SectionHeading from '../components/SectionHeading.astro';
import { loadSiteData } from '../lib/content';

const { club } = await loadSiteData();
const mapQuery = encodeURIComponent(`${club.stadium}, ${club.city}, Malaysia`);
---

<BaseLayout title="Contact" description={`Get in touch with ${club.name}.`}>
  <div class="mx-auto max-w-4xl space-y-10 px-[--spacing-gutter] py-12">
    <SectionHeading title="Contact" />

    <div class="grid gap-8 sm:grid-cols-2">
      <div>
        <h2 class="text-sm tracking-[0.3em] text-[--color-club-gold]">Email</h2>
        <ul class="mt-4 space-y-3">
          {
            club.emails.map((email) => (
              <li>
                <p class="text-xs text-[--color-text-muted]">{email.label}</p>
                <a href={`mailto:${email.address}`} class="underline">
                  {email.address}
                </a>
              </li>
            ))
          }
        </ul>

        <h2 class="mt-8 text-sm tracking-[0.3em] text-[--color-club-gold]">Phone</h2>
        <p class="mt-3">
          <a href={`tel:${club.phone.replace(/\s/g, '')}`} class="underline">{club.phone}</a>
        </p>
      </div>

      <div>
        <h2 class="text-sm tracking-[0.3em] text-[--color-club-gold]">Address</h2>
        <address class="mt-4 not-italic text-[--color-text-muted]">
          {club.stadium}<br />
          {club.city}<br />
          Malaysia
        </address>

        <a
          href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
          rel="noopener"
          target="_blank"
          class="mt-4 text-sm text-[--color-club-gold] underline"
        >
          View on a map
        </a>
      </div>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 3: Build the 404 page**

Create `src/pages/404.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Page not found" description="The page you were looking for does not exist.">
  <div class="mx-auto max-w-2xl px-[--spacing-gutter] py-24 text-center">
    <p class="text-7xl text-[--color-club-red] font-display">404</p>
    <h1 class="mt-4 text-3xl">Page not found</h1>
    <p class="mt-4 text-[--color-text-muted]">
      The page you were looking for has moved or never existed.
    </p>
    <div class="mt-8 flex justify-center gap-4">
      <a href="/" class="clip-corner bg-[--color-club-red] px-6 text-sm tracking-widest text-white font-display">
        Home
      </a>
      <a href="/news" class="clip-corner bg-[--color-ink-card] px-6 text-sm tracking-widest font-display">
        Latest news
      </a>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 4: Add robots.txt**

Create `public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://kedahfa.com/sitemap-index.xml
```

- [ ] **Step 5: Verify everything builds**

```bash
npm run build
ls dist/404.html dist/club dist/contact dist/robots.txt dist/sitemap-index.xml
```

Expected: all present.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add club, contact, 404 pages and robots.txt"
```

---

## Task 13: End-to-end and accessibility tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/navigation.spec.ts`, `tests/e2e/content.spec.ts`, `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: the built site
- Produces: `npm run test:e2e`

- [ ] **Step 1: Install Playwright and axe**

```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install chromium
```

- [ ] **Step 2: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    // Tests the real static output, not the dev server.
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 3: Add the e2e script**

Merge into `"scripts"` in `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Write the navigation tests**

Create `tests/e2e/navigation.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/news', '/squad', '/fixtures', '/standings', '/club', '/contact'];

test.describe('every route renders', () => {
  for (const route of ROUTES) {
    test(`${route} responds with 200 and a single h1`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }
});

test('the header links reach their pages', async ({ page, isMobile }) => {
  await page.goto('/');

  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }

  await page.getByRole('link', { name: 'Squad', exact: true }).click();
  await expect(page).toHaveURL(/\/squad$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Squad');
});

test('the mobile menu opens, closes on Escape and returns focus', async ({ page }) => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only behaviour');

  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('an unknown URL serves the 404 page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
```

- [ ] **Step 5: Write the content tests**

Create `tests/e2e/content.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('the homepage shows a countdown that advances', async ({ page }) => {
  await page.goto('/');

  const seconds = page.locator('.countdown [data-unit="seconds"]').first();
  const first = await seconds.textContent();

  await expect(async () => {
    expect(await seconds.textContent()).not.toBe(first);
  }).toPass({ timeout: 5000 });
});

test('the standings table highlights the club row', async ({ page }) => {
  await page.goto('/standings');
  await expect(page.getByRole('rowheader', { name: /Kedah/ })).toBeVisible();
});

test('standings points are derived, not stored', async ({ page }) => {
  await page.goto('/standings');

  // JDT: 9 wins, 2 draws => 29 points, 11 played.
  const row = page.getByRole('row').filter({ hasText: "Johor Darul Ta'zim" });
  await expect(row.getByRole('cell').last()).toHaveText('29');
});

test('the fixtures page separates upcoming, postponed and results', async ({ page }) => {
  await page.goto('/fixtures');

  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postponed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
});

test('kickoff times render in Malaysian time', async ({ page }) => {
  await page.goto('/fixtures');
  // The JDT home fixture kicks off at 20:45 +08:00.
  await expect(page.getByText('20:45').first()).toBeVisible();
});

test('the news filter narrows the visible articles', async ({ page }) => {
  await page.goto('/news');

  const before = await page.locator('[data-category]:visible').count();
  await page.getByRole('button', { name: 'Transfers' }).click();
  const after = await page.locator('[data-category]:visible').count();

  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

test('a match report links from the fixture row to the article', async ({ page }) => {
  await page.goto('/fixtures');
  await page.getByRole('link', { name: 'Report' }).first().click();
  await expect(page).toHaveURL(/\/news\//);
  await expect(page.locator('h1')).toBeVisible();
});

test('a player profile shows the squad number and details', async ({ page }) => {
  await page.goto('/squad');
  await page.getByRole('link', { name: /Firdaus Rahman/ }).click();

  await expect(page.getByRole('heading', { name: 'Firdaus Rahman' })).toBeVisible();
  await expect(page.getByText('Squad number')).toBeVisible();
});

test('the RSS feed is served and lists articles', async ({ request }) => {
  const response = await request.get('/rss.xml');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('<item>');
});
```

- [ ] **Step 6: Write the accessibility tests**

Create `tests/e2e/accessibility.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/news',
  '/squad',
  '/squad/firdaus-rahman',
  '/fixtures',
  '/standings',
  '/club',
  '/contact',
  '/404',
];

for (const route of ROUTES) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('every image has an alt attribute', async ({ page }) => {
  await page.goto('/news');

  for (const image of await page.locator('img').all()) {
    // Decorative images use alt="" with aria-hidden; both are acceptable.
    expect(await image.getAttribute('alt')).not.toBeNull();
  }
});

test('the skip link is reachable by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
```

- [ ] **Step 7: Run the e2e suite**

```bash
npm run test:e2e
```

Expected: PASS. If axe reports contrast violations, adjust the offending token in `src/styles/tokens.css` — do not weaken the test or add an exclusion.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Playwright navigation, content and accessibility suites"
```

---

## Task 14: CI and deployment

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: all scripts defined above
- Produces: CI on every push; documented deploy settings

- [ ] **Step 1: Ensure build artefacts are ignored**

Confirm `.gitignore` contains these entries; append any that are missing:

```
node_modules/
dist/
.astro/
test-results/
playwright-report/
.DS_Store
```

- [ ] **Step 2: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    # Deliberately UTC: proves the Kuala Lumpur date handling is explicit.
    env:
      TZ: UTC

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Type check and build
        run: npm run build

      - name: Unit tests
        run: npm test

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: End-to-end and accessibility tests
        run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 3: Write the README**

Create `README.md`:

````markdown
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

The build validates everything. If a fixture is missing a score, a team slug is
misspelled, or an image path does not exist, the build fails with a named error
and the live site is left untouched.

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
````

- [ ] **Step 4: Run the full verification locally**

```bash
npm ci && npm run build && npm test && npm run test:e2e
```

Expected: all four commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add CI workflow and project README"
```

- [ ] **Step 6: Configure Cloudflare Pages (manual, outside the repo)**

This step cannot be scripted from here. In the Cloudflare dashboard:

1. Connect the repository and select the `main` branch.
2. Framework preset: Astro. Build command `npm run build`, output directory `dist`.
3. Set environment variable `NODE_VERSION` to `22`.
4. Enable preview deployments for pull requests.
5. Add a daily scheduled deploy (Deploy Hooks plus a cron trigger) so the
   homepage advances past played fixtures without a commit.
6. Update `site` in `astro.config.mjs` and the `Sitemap:` line in
   `public/robots.txt` if the production domain differs from `kedahfa.com`.

---

## Self-review

**Spec coverage.** Every spec section maps to a task: architecture and content
model → Tasks 2 and 5; the three content-model decisions (fixtures-and-results
as one record, derived standings, validated cross-references) → Tasks 2, 3 and
5; timezone handling → Task 1, enforced by UTC in both Vitest and CI; all ten
routes and the homepage's seven sections → Tasks 8 to 12; design system →
Task 6; build-time and runtime error handling → Tasks 2, 5 and 12; the full
test matrix → Tasks 1, 3, 4, 5 and 13; deployment → Task 14.

**Two spec requirements needed explicit placement.** Empty-state copy for every
list is covered by the `EmptyState` component used in each list-rendering
branch. The "no silent truncation" concern around uniqueness checks is handled
by `assertUniqueIds` and `assertUniqueSquadNumbers` naming every offender rather
than the first.

**One route was restructured during review.** The spec's `/news` pagination
originally sat at `src/pages/news/[...page].astro`, directly beside
`src/pages/news/[slug].astro` — a rest route and a dynamic route competing for
`/news/<something>`. Numbered pages moved to `/news/page/N`, which removes the
ambiguity rather than depending on route-ranking behaviour, and the paging maths
moved into `src/lib/pagination.ts` where it is unit tested like every other
derivation. Page 1 exists only at `/news`, so there is no duplicate-content URL.

**One risk is flagged in-plan rather than resolved.** Task 2 Step 11 verifies
that Astro applies top-level Zod `.refine()` to collection schemas. If it does
not, the step gives the fallback: move the refinements into `src/lib/validate.ts`
and call them from `loadSiteData()`. This is checked before any page depends on
it.

**Type consistency.** `Match`, `Player`, `Team`, `Sponsor`, `Article`,
`StandingsInput` and `TableEntry` are defined once and imported everywhere.
Field names match across the YAML schemas in Task 2, the mappers in Task 5's
`loadSiteData()`, and every component that consumes them. `CLUB_SLUG` is
exported once from `src/lib/content.ts` rather than repeated as a string
literal.

One mismatch was found and fixed: `CategoryFilter` compared every item against
`dataset.category`, but the fixtures page filters by competition, so its buttons
would have hidden every match. The component now takes a `filterKey` prop and
reads `dataset[key]`, and both call sites pass it.
