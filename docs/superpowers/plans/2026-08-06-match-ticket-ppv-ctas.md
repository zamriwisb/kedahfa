# Ticket and PPV Calls to Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put optional **Buy Ticket** and **Watch Online (PPV)** buttons on upcoming home fixture cards, everywhere those cards appear.

**Architecture:** Two optional URL fields on the `fixtures` content collection flow through `Match` into a new `MatchActions.astro`, which `MatchRow.astro` renders at the bottom of the card. Because `MatchRow` is shared by the homepage fixture slider (`FixturesStrip`) and every list on `/fixtures`, one component change covers both surfaces. Eligibility ("upcoming, at home") is a single exported predicate in `src/lib/fixtures.ts`; the club's home-only rule is additionally enforced at build time by a validator so a mispasted link fails loudly instead of silently vanishing.

**Tech Stack:** Astro 7 content collections, Zod (via `astro/zod`), Tailwind CSS v4 with CSS custom-property tokens, Vitest (unit + build), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-08-06-match-ticket-ppv-ctas-design.md`

## Global Constraints

- **Labels are fixed.** Exactly `Buy Ticket` and `Watch Online (PPV)`. No per-match label override field.
- **Only two URL shapes are legal:** a site-relative path starting with a single `/`, or an absolute `https://` URL. `//evil.com` and `/\evil.com` must be rejected — both leave the site while passing a naive `startsWith('/')` check.
- **Home matches only.** `home` must equal `CLUB_SLUG` (`'kedah'`). An away fixture carrying `tickets` or `stream` is a build error.
- **Never invent design tokens.** Use only names present in `src/styles/tokens.css`. The ones this plan uses: `--color-action`, `--color-action-deep`, `--color-surface`, `--color-brand-deep`, `--color-brand-panel`, `--color-text-invert`, `--radius-card`.
- **No new dependencies.**
- **Placeholder seed URLs must be obviously fake** (`https://example.com/...`) and documented as replace-before-live in `src/data/fixtures.yaml`'s header comment.
- Commands: `npm test` (fast unit), `npm run test:build` (slow, real `astro check && astro build`), `npm run test:e2e`, `npm run build`.

---

### Task 1: `sellableMatch` eligibility predicate

**Files:**
- Modify: `src/lib/fixtures.ts:10-21` (the `Match` interface), and append the new function after `outcomeFor`
- Test: `tests/unit/fixtures.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `Match.tickets?: string` and `Match.stream?: string`
  - `sellableMatch(match: Match, clubSlug: string, now: Date): boolean`

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/fixtures.test.ts`. The `match()` factory and the `CLUB`, `JDT_HOME`, `TERENGGANU_AWAY`, `SELANGOR_HOME_WIN`, `POSTPONED_CUP`, `OVERDUE_SABAH` constants already exist at the top of that file — reuse them, do not redefine them. Add `sellableMatch` to the existing import list from `'../../src/lib/fixtures'`.

```ts
describe('sellableMatch', () => {
  const NOW = new Date('2026-07-25T12:00:00+08:00');

  it('accepts an upcoming home fixture', () => {
    expect(sellableMatch(JDT_HOME, CLUB, NOW)).toBe(true);
  });

  it('rejects an away fixture: those tickets are the host club to sell', () => {
    expect(sellableMatch(TERENGGANU_AWAY, CLUB, NOW)).toBe(false);
  });

  it('rejects a home fixture whose kickoff has passed', () => {
    expect(sellableMatch(JDT_HOME, CLUB, new Date('2026-08-02T21:00:00+08:00'))).toBe(false);
  });

  it('rejects a home fixture kicking off exactly now', () => {
    expect(sellableMatch(JDT_HOME, CLUB, JDT_HOME.date)).toBe(false);
  });

  it('rejects a finished home match', () => {
    expect(sellableMatch(SELANGOR_HOME_WIN, CLUB, new Date('2026-07-01T12:00:00+08:00'))).toBe(
      false,
    );
  });

  it('rejects a postponed home match even though its stored date is ahead', () => {
    expect(sellableMatch(POSTPONED_CUP, CLUB, NOW)).toBe(false);
  });

  it('rejects a home match still awaiting its result', () => {
    expect(sellableMatch(OVERDUE_SABAH, CLUB, NOW)).toBe(false);
  });

  it('does not care whether any URL is set — that is the component job', () => {
    const withLink = match({
      id: 'with-link',
      date: '2026-08-02T20:45:00+08:00',
      tickets: 'https://example.com/tickets',
    });
    expect(sellableMatch(withLink, CLUB, NOW)).toBe(true);
    expect(sellableMatch(JDT_HOME, CLUB, NOW)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/fixtures.test.ts`
Expected: FAIL — `sellableMatch` is not exported from `src/lib/fixtures`. The last case also fails to type-check because `Match` has no `tickets` field yet.

- [ ] **Step 3: Add the two fields to `Match`**

In `src/lib/fixtures.ts`, extend the interface (keep every existing field exactly as it is):

```ts
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
  /** Where to buy tickets for this match. Rendered only under sellableMatch's rules. */
  tickets?: string;
  /** Where to watch the pay-per-view stream. Same rules. */
  stream?: string;
}
```

- [ ] **Step 4: Write the predicate**

Append to `src/lib/fixtures.ts`, after `outcomeFor`:

```ts
/**
 * Whether a match is one this club can sell to: an upcoming fixture at home.
 *
 * The first two conditions are upcomingMatches()' predicate — scheduled, and
 * kickoff still ahead — so postponed fixtures (stale stored date) and matches
 * awaiting a result are both excluded for the reasons documented there. The
 * third is the club's own rule: tickets and the stream for an away match
 * belong to the host club, so this site does not offer them.
 *
 * URL presence is deliberately NOT checked here. Which of the two buttons a
 * card shows depends on which URL is set, and that belongs to the component
 * rendering them; this answers only "may this match carry them at all".
 */
export function sellableMatch(match: Match, clubSlug: string, now: Date): boolean {
  return (
    match.status === 'scheduled' &&
    match.date.getTime() > now.getTime() &&
    match.home === clubSlug
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/fixtures.test.ts`
Expected: PASS, including the pre-existing cases in that file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fixtures.ts tests/unit/fixtures.test.ts
git commit -m "feat: add sellableMatch, the ticket and stream eligibility rule"
```

---

### Task 2: Schema fields and content mapping

**Files:**
- Modify: `src/content.config.ts` — add a shared URL helper near `dateOnly` (around line 96), use it in the `fixtures` schema (line 150-179) and the `slides` schema (line 262-273)
- Modify: `src/lib/content.ts:148-159` (the `matches` mapping)
- Test: `tests/build/build-negative.test.ts`

**Interfaces:**
- Consumes: `Match.tickets` / `Match.stream` from Task 1.
- Produces: `tickets` and `stream` are readable from `loadSiteData()`'s `matches`.

- [ ] **Step 1: Write the failing build test**

Append this case inside the existing `describe('the real build rejects bad content', ...)` block in `tests/build/build-negative.test.ts`. `SCHEDULED_FIXTURE`, `withFixtureEntry`, `withMutatedFile`, `runBuild` and `BUILD_TIMEOUT_MS` all already exist in that file.

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --config vitest.build.config.ts -t "tickets URL that is protocol-relative"`
Expected: FAIL — the build currently succeeds, because `.strict()` has no `tickets` key… in fact `.strict()` makes it fail with an *unrecognized key* error rather than the message above, so the `toMatch` assertion is what fails. Either way, red.

- [ ] **Step 3: Extract the shared URL rule**

In `src/content.config.ts`, add this above the `club` collection (after the `dateOnly` helper, around line 96):

```ts
// A URL an editor supplies for a link that leaves the card: either
// site-relative ("/tickets") or an explicit https:// URL, because club
// promotions legitimately point at ticketing and streaming partners. The two
// rejected forms both leave the site while passing a naive startsWith('/')
// check: "//example.com" is protocol-relative, and a browser normalises the
// backslash in "/\example.com" into the authority position.
//
// The label and example are parameters rather than one generic message so
// each field names itself in the build error — a fixture with a bad stream
// URL should not report itself as a slide problem.
function siteOrHttpsUrl(fieldLabel: string, example: string) {
  return z.string().refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
      value.startsWith('https://'),
    {
      message: `A ${fieldLabel} must be a site-relative path like "${example}" or an absolute https:// URL.`,
    },
  );
}
```

- [ ] **Step 4: Point the slides schema at the helper**

In the `slides` collection, replace the whole inline `href: z.string().refine(...)` block (lines 262-273) with:

```ts
      href: siteOrHttpsUrl('slide href', '/news/slug').optional(),
```

Keep the explanatory comment that sits above it — move it onto the helper only if it duplicates what is already written there; the "club promotions legitimately point at ticketing partners" reasoning is now in the helper, so the remaining slide-specific comment lines can go.

This produces the byte-identical message the existing test `'fails a slide href that is protocol-relative rather than site-relative or https'` asserts. Do not change that wording.

- [ ] **Step 5: Add the two fixture fields**

In the `fixtures` collection schema, add these two keys immediately after `report`, before the closing `})` that precedes `.strict()`:

```ts
      // Optional, and only meaningful on an upcoming home fixture — see
      // sellableMatch() in src/lib/fixtures.ts for the render rule, and
      // assertTicketLinksAreHomeOnly() in src/lib/validate.ts for the
      // build-time guard that an away fixture never carries these.
      tickets: siteOrHttpsUrl('fixture tickets URL', '/tickets').optional(),
      stream: siteOrHttpsUrl('fixture stream URL', '/watch').optional(),
```

- [ ] **Step 6: Map them through in `content.ts`**

In `src/lib/content.ts`, extend the `matches` mapping (line 148-159) with two lines after `report`:

```ts
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
    tickets: e.data.tickets,
    stream: e.data.stream,
  }));
```

- [ ] **Step 7: Run the build tests to verify they pass**

Run: `npx vitest run --config vitest.build.config.ts`
Expected: PASS — both new cases, plus the pre-existing slide-href case still passing on the unchanged message. This takes a couple of minutes; that is normal for this file.

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/lib/content.ts tests/build/build-negative.test.ts
git commit -m "feat: accept optional tickets and stream URLs on a fixture"
```

---

### Task 3: Build-time home-only guard

**Files:**
- Modify: `src/lib/validate.ts` (append after `assertReferencesResolve`)
- Modify: `src/lib/content.ts:8-14` (import) and `:221` (call site, next to `assertUniqueSquadNumbers`)
- Test: `tests/unit/validate.test.ts`, `tests/build/build-negative.test.ts`

**Interfaces:**
- Consumes: `Match.tickets` / `Match.stream` (Task 1), populated by Task 2.
- Produces: `assertTicketLinksAreHomeOnly(matches: TicketLink[], clubSlug: string): void`, where `TicketLink` is `{ id: string; home: string; tickets?: string; stream?: string }`.

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/unit/validate.test.ts`, and add `assertTicketLinksAreHomeOnly` to the existing import list from `'../../src/lib/validate'`.

```ts
describe('assertTicketLinksAreHomeOnly', () => {
  it('accepts a home fixture carrying both links', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [
          {
            id: '2026-08-29-imigresen-ii-h',
            home: 'kedah',
            tickets: 'https://example.com/tickets',
            stream: 'https://example.com/ppv',
          },
        ],
        'kedah',
      ),
    ).not.toThrow();
  });

  it('accepts an away fixture carrying neither', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly([{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii' }], 'kedah'),
    ).not.toThrow();
  });

  it('throws naming the fixture and the tickets field for an away fixture', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii', tickets: '/tickets' }],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: tickets/);
  });

  it('throws naming the stream field for an away fixture', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii', stream: '/watch' }],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: stream/);
  });

  it('names both fields when an away fixture carries both', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [
          {
            id: '2026-09-06-ns-a',
            home: 'negeri-sembilan-ii',
            tickets: '/tickets',
            stream: '/watch',
          },
        ],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: tickets, stream/);
  });

  it('accepts an empty schedule', () => {
    expect(() => assertTicketLinksAreHomeOnly([], 'kedah')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: FAIL — `assertTicketLinksAreHomeOnly` is not exported from `src/lib/validate`.

- [ ] **Step 3: Write the validator**

Append to `src/lib/validate.ts`:

```ts
export interface TicketLink {
  id: string;
  /** The home team's slug. */
  home: string;
  tickets?: string;
  stream?: string;
}

/**
 * Tickets and the pay-per-view stream for an away match are the host club's to
 * sell, so MatchActions never renders them on one. Silently dropping a URL an
 * editor deliberately pasted is the confusing failure mode — this turns it
 * into a build error naming the fixture and the field.
 *
 * This lives here rather than in the fixtures Zod schema because the schema
 * validates one entry at a time and has no business knowing which club the
 * site belongs to. CLUB_SLUG lives in content.ts, which is what calls this.
 */
export function assertTicketLinksAreHomeOnly(matches: TicketLink[], clubSlug: string): void {
  const offenders: string[] = [];
  for (const match of matches) {
    if (match.home === clubSlug) continue;
    const fields: string[] = [];
    if (match.tickets !== undefined) fields.push('tickets');
    if (match.stream !== undefined) fields.push('stream');
    if (fields.length > 0) offenders.push(`  ${match.id}: ${fields.join(', ')}`);
  }

  if (offenders.length === 0) return;
  throw new Error(
    `Tickets and streams are only sold for home matches, but these away fixtures ` +
      `in src/data/fixtures.yaml carry them:\n${offenders.join('\n')}`,
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the build**

In `src/lib/content.ts`, add `assertTicketLinksAreHomeOnly,` to the import block from `'./validate'` (keep the list alphabetical — it goes first, before `assertUniqueSquadNumbers`… note the existing order is `assertNoDuplicateIds, assertNoDuplicateNewsIds, assertPublicAssetsExist, assertReferencesResolve, assertUniqueSquadNumbers`, so insert it after `assertReferencesResolve`).

Then add the call immediately after the existing `assertUniqueSquadNumbers(squad);` line:

```ts
  assertUniqueSquadNumbers(squad);
  assertTicketLinksAreHomeOnly(matches, CLUB_SLUG);
```

- [ ] **Step 6: Write the failing build test**

Append inside the existing `describe` block in `tests/build/build-negative.test.ts`. Add this constant next to `SCHEDULED_FIXTURE` near the top of the file:

```ts
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
```

and this case in the `describe`:

```ts
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
```

- [ ] **Step 7: Run the build tests to verify everything passes**

Run: `npx vitest run --config vitest.build.config.ts`
Expected: PASS — the new case fails the build as designed, and every pre-existing case still passes.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validate.ts src/lib/content.ts tests/unit/validate.test.ts tests/build/build-negative.test.ts
git commit -m "feat: fail the build when an away fixture carries ticket or stream links"
```

---

### Task 4: The buttons on the card

**Files:**
- Create: `src/components/MatchActions.astro`
- Modify: `src/components/MatchRow.astro` (Props, and the markup after the venue row at lines 118-140)
- Modify: `src/components/FixturesStrip.astro:64-69` (one `MatchRow` usage)
- Modify: `src/pages/fixtures.astro` (four `MatchRow` usages, lines 50, 68, 80, 96)
- Modify: `src/data/fixtures.yaml` (header comment, plus the two seeded fixtures)
- Test: `tests/e2e/content.spec.ts`

**Interfaces:**
- Consumes: `sellableMatch(match, clubSlug, now)` and `Match.tickets` / `Match.stream` from Task 1; the populated data from Tasks 2-3.
- Produces: `MatchRow` gains a **required** `now: Date` prop. Every call site must pass it — `astro check` catches any that does not.

- [ ] **Step 1: Seed two home fixtures**

In `src/data/fixtures.yaml`, extend the "Entry shape" header comment. Insert these lines immediately after the `#   status: scheduled              # scheduled | finished | postponed` line:

```yaml
#
# An upcoming HOME fixture may also offer actions. Both are optional, and both
# are a site-relative path or an https:// URL. They render only while the
# match is still ahead, and never on an away fixture — an away one carrying
# either fails the build:
#
#   tickets: https://tickets.example.com/kedah-imigresen
#   stream: https://ppv.example.com/kedah-imigresen
#
# !! The two fixtures below currently carry https://example.com placeholders.
# !! Replace them with the club's real ticketing and PPV URLs before launch.
```

Then add both fields to the two nearest upcoming home fixtures. On `2026-08-29-imigresen-ii-h`, after `  status: scheduled`:

```yaml
  tickets: https://example.com/tickets/kedah-imigresen
  stream: https://example.com/ppv/kedah-imigresen
```

On `2026-09-12-armed-forces-h`, after `  status: scheduled`:

```yaml
  tickets: https://example.com/tickets/kedah-armed-forces
  stream: https://example.com/ppv/kedah-armed-forces
```

- [ ] **Step 2: Write the failing e2e tests**

Append to `tests/e2e/content.spec.ts`:

```ts
test('an upcoming home fixture offers tickets and the PPV stream', async ({ page }) => {
  await page.goto('/');

  const tickets = page.getByRole('link', { name: /^Buy Ticket/ }).first();
  await expect(tickets).toBeVisible();
  // The seeded links are off-site, so they must open in a new tab and say so.
  await expect(tickets).toHaveAttribute('target', '_blank');
  await expect(tickets).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(tickets).toHaveAccessibleName(/opens in a new tab/);

  await expect(page.getByRole('link', { name: /^Watch Online/ }).first()).toBeVisible();
});

test('an away fixture offers no ticket or stream actions', async ({ page }) => {
  await page.goto('/fixtures');

  // The first away fixture of the season, at Stadium Tampin. Its card is
  // rendered by the same component as the home ones, so this is the assertion
  // that proves the home-only rule reaches the page and not just the tests.
  const away = page.locator('[data-competition]').filter({ hasText: 'Stadium Tampin' }).first();
  await expect(away).toBeVisible();
  await expect(away.locator('[data-match-actions]')).toHaveCount(0);
});
```

- [ ] **Step 3: Run the e2e tests to verify they fail**

Run: `npx playwright test tests/e2e/content.spec.ts -g "tickets and the PPV stream"`
Expected: FAIL — no link named "Buy Ticket" exists.

- [ ] **Step 4: Create `MatchActions.astro`**

Create `src/components/MatchActions.astro`:

```astro
---
import { sellableMatch, type Match } from '../lib/fixtures';

interface Props {
  match: Match;
  clubSlug: string;
  now: Date;
  /** The next-match card inverts to brand green; the outlined button follows it. */
  highlight?: boolean;
}

const { match, clubSlug, now, highlight = false } = Astro.props;

interface Action {
  key: 'tickets' | 'stream';
  href: string;
  label: string;
}

// Two independent conditions, deliberately kept apart. sellableMatch answers
// "may this match carry actions at all" (upcoming, at home); the URLs answer
// "is there anywhere to send someone". A match that passes the first and
// fails the second renders nothing at all rather than an empty bar.
const candidates: { key: Action['key']; href: string | undefined; label: string }[] = [
  { key: 'tickets', href: match.tickets, label: 'Buy Ticket' },
  { key: 'stream', href: match.stream, label: 'Watch Online (PPV)' },
];

const actions: Action[] = sellableMatch(match, clubSlug, now)
  ? candidates.filter((c): c is Action => c.href !== undefined)
  : [];

// The schema guarantees only two shapes reach here: a site-relative path or
// an https:// URL. Only the second leaves the site, so only it opens a tab.
const isExternal = (href: string) => href.startsWith('https://');

const PRIMARY = 'bg-(--color-action) text-(--color-text-invert) hover:bg-(--color-action-deep)';

// The outlined button has to read against two surfaces. On white,
// --color-action is 6.66:1 as text and comfortably clears the 3:1 WCAG 1.4.11
// asks of the border. On the inverted green card it would not, so the
// invert-white pair CardCarousel already uses on green takes over there.
const SECONDARY = highlight
  ? 'border border-(--color-text-invert)/60 text-(--color-text-invert) hover:bg-(--color-text-invert) hover:text-(--color-brand-panel)'
  : 'border border-(--color-action) text-(--color-action) hover:bg-(--color-action) hover:text-(--color-text-invert)';
---

{
  actions.length > 0 && (
    <div
      class:list={[
        'grid gap-2 px-4 py-3',
        actions.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
        highlight ? 'bg-(--color-brand-deep)' : 'bg-(--color-surface)',
      ]}
      data-match-actions
    >
      {actions.map((action) => (
        <a
          href={action.href}
          data-action={action.key}
          target={isExternal(action.href) ? '_blank' : undefined}
          rel={isExternal(action.href) ? 'noopener noreferrer' : undefined}
          class:list={[
            'inline-flex min-h-11 items-center justify-center rounded-(--radius-card) px-3 py-2 text-center font-display text-xs leading-tight tracking-[0.08em] transition-colors',
            action.key === 'tickets' ? PRIMARY : SECONDARY,
          ]}
        >
          {action.label}
          {isExternal(action.href) && <span class="sr-only"> (opens in a new tab)</span>}
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Render it from `MatchRow`**

In `src/components/MatchRow.astro`, add the import beneath the existing ones:

```ts
import MatchActions from './MatchActions.astro';
```

Add `now` to the Props interface and the destructure. The interface becomes:

```ts
interface Props {
  match: Match;
  teamsBySlug: Map<string, Team>;
  clubSlug: string;
  /** Build time, used to decide whether this match can still be sold to. */
  now: Date;
  /** The next upcoming match is inverted to the brand green, per the reference. */
  highlight?: boolean;
}

const { match, teamsBySlug, clubSlug, now, highlight = false } = Astro.props;
```

Then, immediately after the closing `</div>` of the venue/report row (the last block in the file, ending at line 140) and before the component's final `</div>`, add:

```astro
  <MatchActions match={match} clubSlug={clubSlug} now={now} highlight={highlight} />
```

- [ ] **Step 6: Pass `now` at all five call sites**

`src/components/FixturesStrip.astro` — the component already has `now` in scope from its own props:

```astro
              <MatchRow
                match={match}
                teamsBySlug={teamsBySlug}
                clubSlug={clubSlug}
                now={now}
                highlight={next?.id === match.id}
              />
```

`src/pages/fixtures.astro` — the page already declares `const now = new Date();` at line 12. All four usages take the same added prop; each currently reads:

```astro
<MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} />
```

and becomes:

```astro
<MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={CLUB_SLUG} now={now} />
```

Apply that to all four (Upcoming, Awaiting Result, Postponed, Results).

- [ ] **Step 7: Type-check and build**

Run: `npm run build`
Expected: PASS with zero `astro check` errors. A missed call site surfaces here as a missing-prop error.

- [ ] **Step 8: Run the e2e tests to verify they pass**

Run: `npx playwright test tests/e2e/content.spec.ts`
Expected: PASS — both new cases and every pre-existing case in the file.

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run test:e2e`
Expected: PASS. Pay attention to `tests/e2e/accessibility.spec.ts` — it runs axe over the pages and is the check that the new buttons' contrast and naming hold up.

- [ ] **Step 10: Commit**

```bash
git add src/components/MatchActions.astro src/components/MatchRow.astro src/components/FixturesStrip.astro src/pages/fixtures.astro src/data/fixtures.yaml tests/e2e/content.spec.ts
git commit -m "feat: offer tickets and the PPV stream on upcoming home fixtures"
```

---

### Task 5: Align the crests across cards

**Files:**
- Modify: `src/components/MatchRow.astro` (the crest row and the venue row)
- Test: `tests/e2e/layout.spec.ts`

**Interfaces:**
- Consumes: `MatchRow`'s post-Task-4 structure — header row, crest row, venue/report row, `<MatchActions />`.
- Produces: no API change. Purely presentational.

**The defect.** `MatchRow`'s crest row is `flex flex-1 items-center`, so the crest/name block is centred in whatever vertical space the card has left over. That leftover differs card to card for two reasons: a club name long enough to wrap ("Negeri Sembilan II") takes two lines where "Kedah FA" takes one, and after Task 4 a card with an action bar has less room than one without. Neighbouring cards therefore render their crests at different heights — visible as a ragged row in the homepage slider and in the `/fixtures` grid.

Card *height* is not the problem and needs no fix: the carousel's `flex` row and the grid both stretch items to a common height already.

**The fix.** Stop letting the crest row absorb slack, and reserve a fixed two lines for every club name. Then the header and crest rows are identical in height on every card, the crests land at the same offset from the card top regardless of what sits below, and the leftover space collects above the pinned bottom stack instead.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/layout.spec.ts`. This measures the rendered geometry rather than asserting on classes, so it survives a different fix:

```ts
test('club crests line up across neighbouring fixture cards', async ({ page }) => {
  await page.goto('/fixtures');

  // The first row of the Upcoming grid: cards whose names wrap differently
  // and, after the ticket CTAs landed, whose bottom stacks differ in height.
  const crests = page.locator('[data-competition] img');
  const count = await crests.count();
  expect(count).toBeGreaterThan(3);

  const tops: number[] = [];
  for (let i = 0; i < 4; i++) {
    const box = await crests.nth(i).boundingBox();
    expect(box).not.toBeNull();
    tops.push(box!.y);
  }

  // Cards in the same grid row must place their crests at the same y. Cards
  // in the next row down are offset by the row height, so compare only the
  // distinct values within a row: the first two cards share row one.
  expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
  expect(Math.abs(tops[2] - tops[3])).toBeLessThan(1);
});

test('a card with ticket actions keeps its crests level with one without', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card-carousel__track [data-competition]');
  const withActions = cards.filter({ has: page.locator('[data-match-actions]') }).first();
  const withoutActions = cards.filter({ hasNot: page.locator('[data-match-actions]') }).first();

  const a = await withActions.locator('img').first().boundingBox();
  const b = await withoutActions.locator('img').first().boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();

  // This is the regression the action bar introduced: the taller card's
  // crest floated up because the crest row was centred in the slack.
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx playwright test tests/e2e/layout.spec.ts -g "crests"`
Expected: FAIL — the crest `y` values differ by more than a pixel.

- [ ] **Step 3: Drop `flex-1` from the crest row**

In `src/components/MatchRow.astro`, the crest row currently opens:

```astro
  <div class="flex flex-1 items-center justify-between gap-2 px-3 py-5">
```

Remove `flex-1` so the row's height is decided by its content, identical on every card. Keep `items-center` — it is what vertically centres the VS/score column against the crest columns, and with a now-fixed row height it centres consistently:

```astro
  <div class="flex items-center justify-between gap-2 px-3 py-5">
```

- [ ] **Step 4: Reserve two lines for every club name**

Both the home and away name spans currently read:

```astro
      <span
        class:list={[
          'w-full text-sm leading-tight font-display',
          highlight ? 'text-(--color-text-invert)' : 'text-(--color-text)',
        ]}
      >
```

Add `min-h-9` to each (`2.25rem` = 36px, which is two lines of `text-sm`/`leading-tight` at 17.5px each). A one-line name then occupies the same box as a wrapped one:

```astro
      <span
        class:list={[
          'w-full min-h-9 text-sm leading-tight font-display',
          highlight ? 'text-(--color-text-invert)' : 'text-(--color-text)',
        ]}
      >
```

Apply to both spans — the home one and the away one.

- [ ] **Step 5: Pin the bottom stack**

The slack removed in Step 3 has to go somewhere, or short cards will not fill the height the grid stretches them to. Send it above the venue row by adding `mt-auto` to that row's class list. It currently opens:

```astro
  <div
    class:list={[
      'flex items-center justify-between gap-2 px-4 py-2 text-xs',
      highlight
        ? 'bg-(--color-brand-ink) text-(--color-text-invert-muted)'
        : 'bg-(--color-page) text-(--color-text-muted)',
    ]}
  >
```

becomes:

```astro
  <div
    class:list={[
      'mt-auto flex items-center justify-between gap-2 px-4 py-2 text-xs',
      highlight
        ? 'bg-(--color-brand-ink) text-(--color-text-invert-muted)'
        : 'bg-(--color-page) text-(--color-text-muted)',
    ]}
  >
```

`MatchActions` sits below it and needs no change — it follows the pinned venue row.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test tests/e2e/layout.spec.ts`
Expected: PASS, including the pre-existing cases in that file.

- [ ] **Step 7: Check it visually**

Capture `/` and `/fixtures` at both a 390px (phone) and 1280px (desktop) viewport and look at them. The crest rows must read as a level line across each row of cards, and no card may show an awkward gap between its crests and its venue row. Attach the observation to the report — a passing geometry assertion is not the same as it looking right.

- [ ] **Step 8: Run the full suite**

Run: `npm run build && npm test && npm run test:e2e`
Expected: PASS. `tests/e2e/accessibility.spec.ts` must stay green.

- [ ] **Step 9: Commit**

```bash
git add src/components/MatchRow.astro tests/e2e/layout.spec.ts
git commit -m "fix: line the crests up across fixture cards"
```

---

## Verification

After Task 4, run everything once more from a clean state:

```bash
npm test && npm run test:build && npm run build && npm run test:e2e
```

All four must pass before this is considered done. `npm run test:build` is slow (a few minutes) — that is expected, and it is the only suite that proves the new schema and validator actually fail the real build.

## Known follow-up

The seeded URLs are `https://example.com` placeholders. They must be swapped for the club's real ticketing and PPV links before launch; `src/data/fixtures.yaml`'s header comment carries that warning. Once real links exist, the remaining home fixtures should get them too.
