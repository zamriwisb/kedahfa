# Ticket and PPV calls to action on match cards

Date: 2026-08-06

## Problem

A visitor who sees an upcoming home fixture has no way to act on it. The card
tells them when Kedah play and where, then stops. Tickets and the pay-per-view
stream are the two things the club actually wants from that moment, and neither
is reachable from the fixture.

## Scope

Add optional **Buy Ticket** and **Watch Online (PPV)** buttons to the match
card. The card component (`MatchRow.astro`) is shared by the homepage fixture
slider and every list on `/fixtures`, so both surfaces are covered by one
change. No new slider is built — `FixturesStrip` + `CardCarousel` already
provide one.

Out of scope: ticketing or streaming integration of any kind. These are links
to whatever partner the club uses.

## Data model

`fixtures` gains two optional fields in `src/content.config.ts`:

```yaml
- id: 2026-08-29-imigresen-ii-h
  competition: A1 Semi-Pro League
  matchweek: 1
  date: 2026-08-29T20:45:00+08:00
  venue: Darul Aman Stadium
  home: kedah
  away: imigresen-ii
  status: scheduled
  tickets: https://tickets.example.com/kedah-imigresen
  stream: https://ppv.example.com/kedah-imigresen
```

Both accept a site-relative path (`/tickets`) or an absolute `https://` URL,
using the same refine `slides.href` already applies. That rule rejects
`//evil.com` and `/\evil.com`, both of which leave the site while passing a
naive `startsWith('/')` check. The refine currently sits inline in the slides
schema; it is extracted into one helper in `content.config.ts` so all three
fields cannot drift apart.

`Match` in `src/lib/fixtures.ts` gains `tickets?: string` and `stream?: string`.
`content.ts` maps them through alongside `report`.

Labels are fixed — "Buy Ticket" and "Watch Online (PPV)". Editors supply a URL
and nothing else, so a long custom label can never break the card layout.

## Rules

A button renders when **all** of the following hold:

1. the corresponding URL is set;
2. the match is upcoming — `status === 'scheduled'` and kickoff is still in the
   future;
3. Kedah are the home team.

Condition 3 is the club's rule: away tickets are the host club's to sell.

The first two conditions are exactly `upcomingMatches`' predicate. Rather than
repeat that date arithmetic in a template, `fixtures.ts` exports one helper the
card and the tests both call:

```ts
export function sellableMatch(match: Match, clubSlug: string, now: Date): boolean
```

Finished and postponed fixtures may keep their `tickets`/`stream` values in
YAML. They simply do not render. Rejecting them would break the build the
moment an editor records a score without also deleting the ticket URL, and the
card already refuses to show a stale link.

An **away** fixture carrying either field is a build error, raised by a new
`assertTicketLinksAreHomeOnly(matches, clubSlug)` in `src/lib/validate.ts` and
called from `content.ts`'s `build()`. Silently dropping a link an editor
deliberately pasted is the confusing failure; an error naming the fixture id is
not. This check lives in `validate.ts` rather than the Zod schema because
`CLUB_SLUG` belongs to `content.ts` — the schema has no business knowing which
club the site is for.

## UI

A new `src/components/MatchActions.astro` takes the match, `clubSlug` and
`now`, and renders nothing when `sellableMatch` is false or no URL is set.
Keeping it out of `MatchRow` stops that file taking on a fourth concern and
gives the tests a single component to point at. `MatchRow` renders it as the
last block of the card, below the venue/report row.

```
┌─────────────────────────────────┐
│ Sat 29 Aug · 8:45 PM  A1 League │
├─────────────────────────────────┤
│    (crest)   VS   (crest)       │
│     Kedah      Imigresen II     │
├─────────────────────────────────┤
│ Darul Aman Stadium              │
├─────────────────────────────────┤
│ ██ BUY TICKET ██ │ Watch Online │
└─────────────────────────────────┘
```

- **Buy Ticket** — filled `--color-action`, the primary treatment `CtaButton`
  already uses.
- **Watch Online (PPV)** — outlined secondary, so the hierarchy is unambiguous.
- Two-column grid, equal heights, `min-h-11` to hold the 44px minimum target
  `global.css` enforces. At the homepage strip's 288px card the PPV label wraps
  to two lines and both buttons grow together.
- One link set, not both: that button spans the full width.
- An absolute `https://` link opens in a new tab with `rel="noopener
  noreferrer"` and an sr-only "(opens in a new tab)". A site-relative link
  stays in-tab and gets neither.
- On the highlighted next-match card (`--color-brand-deep`), the outlined
  button swaps to the invert-white border/text pair `CardCarousel` uses on
  green — those tokens are already measured against that surface. The filled
  red button is unchanged.

## Seed data

The next two home fixtures — `2026-08-29-imigresen-ii-h` and
`2026-09-12-armed-forces-h` — get obvious placeholder URLs under
`https://example.com/`, so the feature is visible on the running site and the
e2e test has something to assert against.

**These placeholders must be replaced with the club's real ticketing and PPV
URLs before this goes live.** The `fixtures.yaml` header comment documents both
fields and says so.

## Testing

- `tests/unit/fixtures.test.ts` — `sellableMatch` rejects a past kickoff, a
  finished match, a postponed match and an away fixture; accepts an upcoming
  home fixture. URL presence is not its concern — `MatchActions` checks that
  per button, so a match can be sellable and still render nothing.
- `tests/unit/validate.test.ts` — `assertTicketLinksAreHomeOnly` throws naming
  the fixture id for an away fixture with `tickets`, and for one with `stream`;
  passes for home fixtures and for away fixtures with neither.
- `tests/build/build-negative.test.ts` — `//evil.com` and `/\evil.com` in
  `tickets` fail the build.
- `tests/e2e/content.spec.ts` — the homepage next-match card shows both CTAs
  and the ticket link points off-site; a result card shows neither.

## Notes

`now` is evaluated at build time, as everywhere else on this site. A fixture
whose kickoff passes without a redeploy keeps showing its buttons until the
next build — the same constraint the countdown and the upcoming/results split
already carry, and the reason for the daily scheduled build.
