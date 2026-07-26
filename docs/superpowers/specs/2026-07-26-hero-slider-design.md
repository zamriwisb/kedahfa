# Hero Slider — Design

Date: 2026-07-26
Status: Approved

## Problem

The homepage opens with `HeroPanel`, a full-bleed panel showing a single
computed match (next fixture or latest result). The club has no way to promote
anything else in that slot — ticket sales, campaigns, signings — without
editing a component.

The reference design (WKS Śląsk Wrocław) puts a full-width, auto-advancing
slider directly under the header: a photo per slide with a date, a headline and
small dash indicators at the bottom right.

## Goal

Replace `HeroPanel` on the homepage with a curated, editorially-controlled
full-width slider whose slides are defined in YAML.

Scope is the homepage only. No other page gains a slider.

## Data

### `src/data/slides.yaml`

A new YAML array following the existing `src/data/*.yaml` convention. Because
it lives in `src/data/` and uses the array-of-entries-with-`id` shape, it is
picked up automatically by `dataFilesWithIds()` in `src/lib/content.ts` and
therefore by the existing duplicate-id check — no change needed there.

```yaml
- id: tickets-selangor
  image: /images/slides/tickets.jpg
  imageAlt: Packed north stand at Darul Aman Stadium
  eyebrow: 07/07/2026
  title: Buy tickets for Kedah vs Selangor
  href: /news/tickets-selangor
  cta: Buy Tickets
  order: 1
```

### Field contract

| Field      | Required | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| `id`       | yes      | Unique across the file. Enforced by `assertNoDuplicateIds`.  |
| `image`    | yes      | Public-absolute path. Existence checked at build.            |
| `imageAlt` | yes      | Non-empty. Describes the photo, not the headline.            |
| `eyebrow`  | no       | Short line above the headline — a date or a label.           |
| `title`    | yes      | The headline.                                                |
| `href`     | no       | Link target for the headline.                                |
| `cta`      | no       | Button label. Requires `href`.                               |
| `order`    | no       | Sort key, ascending. Slides without it sort after those with. |

### Collection registration

`src/content.config.ts` gains a `slides` collection using the `file()` loader,
with a Zod schema encoding the table above. The `cta`-requires-`href` rule is a
`.refine()` on the schema so it fails the build, not at render time.

### Loading

`loadSiteData()` in `src/lib/content.ts` gains a `slides: Slide[]` field on
`SiteData`, mapped from the collection entries and sorted by `order` (ascending,
missing last) then by file order. Each slide's `image` is added to the paths
passed to the existing `assertPublicAssetsExist()` call, so a wrong path fails
the build rather than shipping a broken slide.

The `Slide` interface is declared in `src/lib/content.ts` alongside `Article`
and `Sponsor`. Sorting lives in a small `src/lib/slides.ts` so it is unit
testable without a build.

### Seed content

Three example slides ship, all pointing at the existing
`/images/news/placeholder.svg`. `public/images/slides/` is created (with a
`.gitkeep`) for the real photography. Swapping in real assets is a YAML edit;
the asset validator catches a typo'd path at build time.

## Component — `src/components/HeroSlider.astro`

### Props

`slides: Slide[]`. Renders nothing when the array is empty, so the homepage
degrades to opening with `FixturesStrip`.

### Structure

A full-bleed `<section>` matching the heights `HeroPanel` used —
`min-h-[420px]`, `sm:min-h-[540px]`, `lg:min-h-[620px]` — containing a
horizontal scroll-snap track:

```
<section aria-roledescription="carousel" aria-label="Featured">
  <ul class="flex overflow-x-auto snap-x snap-mandatory">
    <li class="w-full shrink-0 snap-start" aria-roledescription="slide"
        aria-label="1 of 3">
      <img>                       full-bleed, object-cover
      <div>                       gradient scrim
      <div class="max-w-6xl">     eyebrow / headline / optional CTA
    </li>
    ...
  </ul>
  <div>                           dash buttons, bottom-right
</section>
```

The track is a scroll-snap container rather than a JS-swapped stack of
absolutely positioned slides. Touch swipe and no-JS behaviour then come from
the browser, and JavaScript only *adds* autoplay and indicator syncing. If the
script fails to run, the slider remains a working scrollable gallery instead of
a dead single frame.

Scrollbars on the track are hidden (`scrollbar-width: none` plus the WebKit
pseudo-element) since the dashes are the affordance.

### Layout

Overlay content sits inside the same `mx-auto max-w-6xl px-(--spacing-gutter)`
container used by every other homepage section, so slide headlines align with
the content below rather than floating against the viewport edge. Dashes align
to the right edge of that same container, vertically near the bottom.

Type follows the existing hero: `font-display` uppercase headline at
`text-4xl` / `sm:text-6xl` / `lg:text-7xl`, eyebrow at `text-sm` in
`font-display`. The optional CTA reuses the `clip-corner` + `--color-action`
treatment from `HeroPanel`'s Match Report button.

### Contrast

The section carries a solid `--color-brand-ink` background behind the photo, a
`bg-gradient-to-t` scrim above it, and an **explicit** `--color-text-invert`
(or `--color-text-invert-muted`) on every text node.

This mirrors `HeroPanel` deliberately. The axe check in the e2e suite resolves
a text node's effective background from the nearest ancestor's CSS
`background-color` — not from an absolutely positioned image or gradient. A
dark section background with no explicit text colour is exactly what produced a
1.42:1 failure in that component before. Every text node setting its own invert
colour keeps the slider AA-safe regardless of how a given photo renders.

## Behaviour

An inline `<script>` in the component, matching the island style already used
by `MobileNav.astro` — no framework, no dependency.

- **Autoplay**: advances every 6000ms via
  `track.scrollTo({ left, behavior: 'smooth' })`, wrapping from the last slide
  back to the first.
- **Pause**: on `pointerenter` over the section, on `focusin` within it, and on
  `document.visibilitychange` when the tab is hidden. Resumes on the inverse
  events.
- **Stop**: any deliberate interaction — dash click, arrow key, or a manual
  scroll of the track — cancels autoplay permanently for that page view. A
  slide is never yanked away from someone reading it.
- **Keyboard**: `ArrowLeft` / `ArrowRight` move one slide when focus is inside
  the region. The track is focusable (`tabindex="0"`) with an accessible name,
  following the pattern already used by the featured-squad scroller on the
  homepage.
- **Indicator sync**: an `IntersectionObserver` on the slides (threshold 0.6)
  sets the active dash. Because it observes the result rather than the cause,
  the dashes stay correct no matter what moved the track — autoplay, swipe,
  keyboard or scrollbar.
- **Reduced motion**: under `prefers-reduced-motion: reduce`, autoplay never
  starts and scrolling uses `behavior: 'auto'`.
- **Single slide**: no dashes are rendered, no observer or timer is created.

### Accessibility

- `aria-roledescription="carousel"` and `aria-label="Featured"` on the section.
- Each slide: `aria-roledescription="slide"`, `aria-label="N of M"`.
- Dashes are real `<button type="button">` elements with
  `aria-label="Go to slide N"` and `aria-current="true"` on the active one.
  They meet the global 44px target minimum via padding around the visible dash.
- The headline is the link when `href` is set; the whole slide is not a click
  target, which keeps a single unambiguous link per slide.
- No `aria-live` region. Autoplay stops on interaction and the content is
  decorative-promotional, so announcing every rotation would be noise.

## Removals

- `src/components/HeroPanel.astro` is deleted.
- `index.astro` drops the `HeroPanel` import and its `hero` computation.
- `selectHero()`, the `Hero` type and `HERO_RESULT_WINDOW_DAYS` in
  `src/lib/fixtures.ts` lose their only caller and are deleted, along with the
  `describe('selectHero')` block and the `selectHero` import in
  `tests/unit/fixtures.test.ts`. `HERO_RESULT_WINDOW_DAYS` is used only by
  `selectHero`, so it goes with it. Everything else in `fixtures.ts` —
  `nextMatch`, `recentResults`, `upcomingMatches`, `awaitingResult`,
  `finishedMatches`, `outcomeFor`, `groupByMonth` — has other callers and
  stays.

`FixturesStrip` continues to carry fixtures and results directly below the
slider, so nothing that was on the page is lost.

## Testing

**Unit** (`tests/unit/slides.test.ts`)

- Slides sort by `order` ascending; slides without `order` fall after those
  with one, preserving file order among themselves.
- Empty input returns an empty array.

**Build-negative** (extends `tests/unit/build-negative.test.ts`)

- A slide whose `image` points at a missing public asset fails the build.
- A slide with `cta` but no `href` fails schema validation.

**E2E** (`tests/e2e/`)

- `/` renders one slide per `slides.yaml` entry, with the first visible.
- Clicking the third dash brings the third slide into view and sets
  `aria-current` on that dash.
- The existing axe scan of `/` stays clean — this is the check that the
  contrast decisions above are actually working.

## Non-goals

- Sliders on any page other than the homepage.
- Video slides.
- A CMS or admin UI for slide management; slides are edited in YAML.
- Per-slide theming (custom colours, text position overrides).
