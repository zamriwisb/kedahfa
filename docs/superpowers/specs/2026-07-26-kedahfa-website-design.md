# Kedah FA Official Website — Design

**Date:** 2026-07-26
**Status:** Approved
**Reference site:** https://kelantanredwarrior.com/

## Purpose

Build the official website for Kedah FA: a static, fast, mobile-first club site
covering news, squad, fixtures and results, league standings, sponsors, and
contact details.

The realistic visitor is a supporter on a phone on mobile data, checking one of
three things: when is the next match, what was the score, and what has the club
said. The design serves that first.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| V1 scope | Core club site | News, squad, fixtures/results, standings, sponsors, contact. No store, no ticketing. |
| Content workflow | Developer edits files | Content is Markdown and YAML in the repo; updates ship via commit and deploy. |
| Language | English only | Matches the reference site's primary language. Keeps one file per article. |
| Assets | Placeholders | Placeholder crest, player silhouettes, sample fixtures. Real assets swap in later. |
| Hosting | Cloudflare Pages | Push to `main`, build and deploy automatically. PR previews. |
| Visual direction | Bold matchday | Dark base, high-contrast club colours, full-bleed photography, condensed display type. |
| Stack | Astro 5 + Tailwind 4 + TypeScript | See below. |

### Why Astro over Next.js or Eleventy

The deciding factor is build-time schema validation. With content as files and
no CMS guardrails, the build being able to reject a broken fixture or a dangling
cross-reference is worth more than Next's larger ecosystem or Eleventy's
minimalism. Astro also ships zero JavaScript by default, which suits a site that
is 95% static text and images, and it stays genuinely static — what Cloudflare
Pages is best at.

Next.js was rejected as heavier than the problem: it ships a React runtime to
render pages of text. Eleventy was rejected for having no typed content schema,
so a malformed fixture renders wrong instead of failing.

### Known trade-off: the file-editing workflow

Every match result, score, and news post requires a commit and a deploy. During
the season that is a standing dependency on a developer.

This is an accepted v1 trade-off — fastest build, zero hosting cost, no CMS to
secure or patch. The content model below is deliberately kept to plain Markdown
and YAML with flat schemas, so a Git-backed CMS (Decap, Sveltia) can be added
later against the same files without restructuring anything.

## Architecture

Content lives in two shapes, chosen by whether the item has prose:

- **Prose → Markdown, one file per item.** News articles only.
- **Structured records → YAML, one file per collection.** Everything else.
  Updating a result means changing two numbers in one file, not locating a file.

Both are loaded through Astro's Content Layer with Zod schemas, so both get
build-time validation and typed access in templates.

```
src/
  content.config.ts        # all schemas + loaders, single source of truth
  content/
    news/*.md              # one article per file
  data/
    club.yaml              # name, founded, stadium, contact, socials
    teams.yaml             # every team in the league
    fixtures.yaml          # all matches, scheduled and finished
    standings.yaml         # league table
    squad.yaml             # players
    sponsors.yaml          # tiered sponsor logos
  components/              # Card, FixtureRow, StandingsTable, PlayerCard, ...
  layouts/
  lib/                     # pure functions, no Astro imports
  pages/
  styles/tokens.css        # brand colours + type scale
public/
  images/{news,squad,teams,sponsors}/
```

`src/lib/` holds all derivation and formatting logic as pure functions with no
Astro imports. That is what the unit tests target. Components stay presentational.

## Content model

### 1. Fixtures and results are one record

There is no separate results file. A match has a status; a result is a finished
fixture that carries a score. This is why the reference site's "Fixtures &
Results" is a single page — they are the same entity.

```yaml
# src/data/fixtures.yaml
- id: 2026-08-02-jdt-h
  competition: Super League
  matchweek: 12                  # optional
  date: 2026-08-02T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah                    # slug into teams.yaml
  away: jdt                      # slug into teams.yaml
  status: scheduled              # scheduled | finished | postponed
  score: { home: 2, away: 1 }    # required if and only if status = finished
  report: kedah-edge-selangor    # optional slug into content/news/
```

Schema refinements:

- `status: finished` **requires** `score`; any other status **forbids** it.
- `home` and `away` must exist in `teams.yaml` and must differ.
- `report`, when present, must match an existing news article slug.

A `postponed` fixture keeps its original date for ordering but renders the label
"Postponed" in place of the kickoff time, and is excluded from both the next-match
card and the recent-results strip. When a new date is confirmed, the record is
edited back to `scheduled` with the new date rather than duplicated.

### 2. Standings store observations; the rest is derived

Only won, drawn, lost, goals-for and goals-against are entered by hand. Played,
points, goal difference and league position are computed at build time, so a
typo cannot produce a table whose arithmetic does not add up.

```yaml
# src/data/standings.yaml
competition: Super League 2026
updated: 2026-07-20
rows:
  - team: jdt      # slug into teams.yaml
    won: 9
    drawn: 2
    lost: 1
    goalsFor: 28
    goalsAgainst: 8
```

Derived in `src/lib/standings.ts`:

- `played = won + drawn + lost`
- `points = won * 3 + drawn`
- `goalDifference = goalsFor - goalsAgainst`
- position by sort: points desc, then goal difference desc, then goals-for desc,
  then team name asc.

Every team in `rows` must exist in `teams.yaml`, and slugs must be unique within
the table.

### 3. Squad

```yaml
# src/data/squad.yaml
- slug: firdaus-rahman
  name: Firdaus Rahman
  number: 9
  position: Forward           # Goalkeeper | Defender | Midfielder | Forward
  nationality: MY             # ISO 3166-1 alpha-2
  dateOfBirth: 1998-04-12
  heightCm: 182
  photo: /images/squad/firdaus-rahman.jpg
  joined: 2024
  bio: Optional short prose.
  stats:                      # optional, hand-maintained
    appearances: 14
    goals: 7
    assists: 3
```

Squad numbers must be unique. `photo` must resolve to a file in `public/`.

Player statistics are entered by hand in this file. Fixtures carry no lineup or
scorer data, so per-player appearances cannot be derived from match records —
recording them would mean a lineup model that the v1 file-editing workflow cannot
realistically be kept current. The player profile page therefore renders the
photo, personal details, bio, and these optional stats, and nothing that would
require appearance data.

### 4. News

Markdown frontmatter:

```yaml
title: Kedah edge Selangor in five-goal thriller
date: 2026-07-19
category: match-report      # match-report | club | transfer | academy
excerpt: One-sentence summary used on cards and in RSS.
image: /images/news/selangor-away.jpg
imageAlt: Required. Enforced by schema.
author: Media Team
draft: false
```

`imageAlt` is required by the schema so accessibility cannot be dropped by
omission. Draft articles are excluded from production builds.

### 5. Teams, sponsors, club

`teams.yaml` holds slug, full name, short name and crest path for every team in
the league — needed to render fixtures and standings without repeating names.
`sponsors.yaml` holds name, tier, logo and URL. `club.yaml` holds club name,
founding year, stadium, contact details and social links, and is the single
source for footer and contact page.

### Timezone handling

All kickoff times are stored as ISO 8601 with an explicit `+08:00` offset and
formatted explicitly in the `Asia/Kuala_Lumpur` timezone.

Cloudflare builds run in UTC. Without an explicit timezone, a 20:45 Saturday
kickoff renders into the built HTML as 12:45 Saturday. This is a build-time
correctness issue, not a display preference.

## Pages and routing

| Route | Contents |
|---|---|
| `/` | Homepage |
| `/news` | Paginated index, 12 per page, category filter |
| `/news/[slug]` | Article |
| `/squad` | Players grouped by position |
| `/squad/[slug]` | Player profile: photo, details, bio, optional stats |
| `/fixtures` | Upcoming and past, grouped by month, competition filter |
| `/standings` | Full table, Kedah's row highlighted |
| `/club` | About, honours, stadium, sponsors |
| `/contact` | Contact details, embedded map, department email links |
| `/404` | Styled not-found |

Also generated: `sitemap.xml`, `rss.xml` for news, `robots.txt`.

**No contact form in v1.** The site is fully static with no backend, and a form
would require a third-party service to receive submissions. `/contact` lists
department email addresses as `mailto:` links and the club's social accounts,
drawn from `club.yaml`. Adding a form is a v2 decision that comes with choosing
a form service and a spam strategy.

**Filters are client-side over pre-rendered content.** All articles for a page
and all fixtures are present in the HTML; the filter islands show and hide them.
Pagination on `/news` applies to the full article list and is unaffected by the
active category filter, so filtering narrows the current page rather than
re-paginating. Filters are additive to a fully working no-JavaScript baseline:
with scripting disabled, every article and fixture is still visible and readable.

### Homepage sections

The hero reflects the club's current state rather than showing a static banner.

1. **Hero** — the latest finished result if it falls within the last 5 days,
   otherwise the next scheduled fixture. Full-bleed photograph, dark gradient
   overlay, scoreline in condensed display type, link to the match report.
2. **Next match** — both crests, competition, kickoff in local time, venue, and
   a live countdown.
3. **Recent results** — the last three, compact.
4. **Standings snippet** — top five, with Kedah's own row pinned below if the
   club sits outside the top five.
5. **Latest news** — six cards, the first double-width.
6. **Squad teaser** — horizontally scrolling player cards.
7. **Sponsors** — grouped by tier, greyscale until hover.

Only three things ship JavaScript, each as an isolated Astro island: the
countdown, the mobile navigation, and the fixture/news filters.

## Design system

All brand decisions live in `src/styles/tokens.css` as CSS custom properties, so
replacing placeholder branding with real Kedah assets is a single-file edit.
The placeholder palette pairs red and gold over a near-black base. These are
stand-in values, not verified club colours — official colour codes, the crest,
and the founding year all need confirming before launch.

- **Typography** — condensed uppercase for display (scores, squad numbers,
  section headers), a neutral sans for body copy. Fonts are self-hosted WOFF2
  with `font-display: swap`. No Google Fonts request, for both speed and privacy.
- **Motifs** — angular clip-path corners on cards, diagonal section dividers,
  squad number treated as a graphic element on player cards. Applied in three or
  four places, not everywhere.
- **Constraints** — interactive targets at least 44px; all text meets WCAG AA
  contrast against its background; all motion respects `prefers-reduced-motion`;
  every image carries explicit dimensions to prevent layout shift.

Mobile-first throughout.

## Error handling

**Build time carries the load.** Any of the following fails the build with a
named error, so a broken commit never reaches the live site:

- a schema violation in any Markdown or YAML file
- a fixture referencing a team slug absent from `teams.yaml`
- a fixture with `status: finished` and no score, or a score with any other status
- a `report` slug with no matching news article
- a standings row for an unknown team, or a duplicate team in the table
- a duplicate squad number
- an image path that does not resolve in `public/`

**Runtime handling is deliberately thin:**

- styled 404 page
- countdown degrades to displaying the kickoff time once the date has passed
- every list has empty-state copy (no fixtures scheduled, no news in this
  category) so an empty data file renders a sentence rather than a blank region

## Testing

- **Vitest against `src/lib/`** — standings derivation and sort order including
  tie-breaks, fixture partitioning into upcoming and past, hero selection logic
  (result-within-5-days versus next fixture), countdown formatting, and Kuala
  Lumpur date formatting. Written before the implementations, per TDD.
- **Schema tests** — malformed fixtures, standings and articles must be rejected
  with the expected error; valid fixtures must pass. Covers every refinement
  listed under Error handling.
- **Playwright smoke tests** — every route renders, navigation works, filters
  work, and axe-core reports no accessibility violations.
- **CI on every push** — `astro check`, production build, Vitest, Playwright.

## Deployment

Cloudflare Pages, building from `main`. Pull requests get preview deployments.
Build output is a plain static bundle with no host-specific features, so the
site can move to another static host without code changes.

## Needed from the club before launch

The build proceeds with placeholders; none of these block implementation, but all
block going live:

- crest in SVG, plus official colour codes
- founding year, full club name, stadium name and capacity
- squad list with photos, numbers, positions and nationalities
- current season fixture list and league table
- sponsor logos and tiers
- contact email addresses and social account handles

## Out of scope for v1

Merchandise store, ticketing and season passes, video hub, newsletter signup,
mobile app links, member accounts, and bilingual content. Each was considered
and deferred. The content model does not preclude any of them.
