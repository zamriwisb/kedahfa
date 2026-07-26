# Card Carousel — Design

Date: 2026-07-26
Status: Approved

## Problem

The homepage's fixtures strip and First Team Squad section are horizontal
scroll strips: an `overflow-x-auto` region wrapping a `snap-x` flex list.
They scroll, but nothing on screen says so. A visitor with a mouse and no
trackpad has only the native scrollbar, and nothing signals that there is
more content to the right.

## Goal

Give both sections visible previous/next controls, and make the squad
section advance on its own, pausing when the visitor's pointer is over it.

Scope is the two homepage sections. `/fixtures` keeps its month-grouped
Upcoming/Results layout and `/squad` keeps its by-position grid — both are
for browsing everything at once, which a carousel works against.

## Why a new component rather than reusing HeroSlider

`HeroSlider.astro` already implements the autoplay behaviour this needs, and
its shape is the template here: pause on `pointerenter`, resume on
`pointerleave`, pause on `focusin`, pause when the tab is hidden, never start
under `prefers-reduced-motion`, and stop permanently on deliberate
interaction.

It cannot be reused directly. `HeroSlider`'s `goTo()` scrolls to
`track.clientWidth * index`, which is only correct because every hero slide
is exactly the width of the track. A card carousel shows several cards at
once, at widths that differ per consumer (`w-72 sm:w-80` for a fixture,
`w-40` for a player). It is a sibling component, not a caller.

`HeroSlider` is not modified. It carries three rounds of accessibility fixes
and nothing here requires touching it.

## `src/components/CardCarousel.astro`

A slot wrapper. Both consumers already render the markup it expects, so this
adds controls around existing structure rather than replacing it.

```astro
<CardCarousel label="Match schedule" itemNoun="fixtures">
  {strip.map((match) => (
    <li class="w-72 shrink-0 snap-start sm:w-80">
      <MatchRow match={match} teamsBySlug={teamsBySlug} clubSlug={clubSlug} />
    </li>
  ))}
</CardCarousel>
```

### Props

| Prop | Type | Purpose |
|---|---|---|
| `label` | `string` | The scroll region's accessible name — "Match schedule", "Featured squad players" |
| `itemNoun` | `string` | Used in control names — "Previous fixtures", "Next players" |
| `autoplay` | `boolean` (default `false`) | Whether the carousel advances on its own |
| `on` | `'light' \| 'green'` (default `'light'`) | Which surface it sits on |
| `name` | `string` | Stable test hook, emitted as `data-carousel` |

`on` exists because the two consumers sit on different surfaces: the fixtures
strip on `--color-page` light grey, the squad band on `--color-brand-panel`
green. One control treatment cannot read against both — `--color-action` red
on green is not legible, and white-on-light is worse. This mirrors
`SectionHeading.astro:18`, which carries the same prop for the same reason.

`name` gives the e2e suite a selector that does not depend on a visible
string, so renaming a label does not silently break a test.

Two label props rather than one derived string. Commit `cb20236` was a fix
for precisely this: a control group whose accessible name did not describe
what it controlled. "Previous Match schedule" is the kind of string a single
prop produces.

### Structure

The component owns the scroll region and the `<ul>`; the slot supplies
`<li>` cards carrying their own width classes.

The region keeps `tabindex="0" role="region" aria-label={label}`. That is not
decoration — a scrollable region a mouse can pan but a keyboard cannot reach
fails WCAG 2.1.1, which axe flags as `scrollable-region-focusable`. It was
fixed once already in Task 13 of the original build and must not regress.

### Paging

Previous/next scroll by one viewport width:

```js
track.scrollBy({ left: direction * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' })
```

Paging by the track rather than by card width keeps the component ignorant of
what its consumers put in the slot. No per-card `offsetLeft` arithmetic, and
no assumption that every card is the same width.

### Controls are hidden until they are useful

Controls render with `hidden` and are revealed by script only when
`track.scrollWidth > track.clientWidth`. Prev and next each disable at their
end of the track.

This is not only progressive enhancement, though it is that too — without JS
the section stays exactly the scroll strip it is today. It is also a real
layout case, and the arithmetic decides the test in both directions:

The shell is `--container-6xl` (72rem = 1152px) less two 1.25rem gutters, so
content is 1112px wide once the viewport reaches that.

- **Squad: 6 cards** (`featuredPlayers` is `.slice(0, 6)`) at `w-40` = 160px
  with `gap-4` = 16px → 6×160 + 5×16 = **1040px**. That fits 1112px, so on
  Desktop Chrome the track does not overflow and its controls stay hidden.
  On Pixel 5 (~353px of content) the same cards overflow and the controls
  appear.
- **Fixtures: 4 cards** currently (two recent results, of which there are
  none yet, plus up to four upcoming) at `sm:w-80` = 320px → 4×320 + 3×16 =
  **1328px**, which overflows 1112px. Its controls show on both viewports.

Controls that scrolled by a handful of pixels, and autoplay looping over
almost nothing, would read as broken.

Which end the track sits at is watched with an `IntersectionObserver` on the
first and last card rather than a `scroll` listener. `HeroSlider:327` records
why a `scroll` listener is the wrong instrument here: it fires for the
component's own programmatic scrolling as well as the visitor's, so it cannot
tell the two apart. That distinction is what the stop-on-interaction rule
depends on.

### Autoplay

Enabled only where a consumer passes `autoplay` — the squad section. Fixtures
get controls with no autoplay, as requested.

Behaviour is `HeroSlider`'s, adapted to paging:

- Advances one page every 6000ms, matching `HeroSlider`'s `AUTOPLAY_MS`.
  Once the last card is in view it wraps to the start.
- `pointerenter` pauses, `pointerleave` resumes. This is the hover-pause
  asked for.
- `focusin` pauses and `focusout` resumes, so a keyboard visitor tabbing
  through cards is not fighting a moving track.
- `visibilitychange` pauses in a hidden tab.
- `prefers-reduced-motion: reduce` means autoplay never starts at all.
- Deliberate interaction — `pointerdown`, `touchstart`, a horizontal wheel,
  or a control click — *stops* autoplay for the page view rather than
  pausing it. A card must not be yanked away from someone who chose it.
  A vertical wheel does not count: that is the visitor scrolling the page
  with the cursor resting over the carousel, which commit `5e1c130` fixed
  in `HeroSlider` after it killed autoplay for most desktop visitors.

### The pause control

A visible pause/play toggle accompanies autoplay.

Hover-pause alone covers only pointer users. WCAG 2.2.2 requires a
discoverable mechanism to stop content that moves automatically, and keyboard
and touch visitors have no hover. This is finding `I4` from the HeroSlider
whole-branch review, which blocked that merge — the same gap would exist here.

The toggle is `hidden` until autoplay actually starts, matching
`HeroSlider:272`. Without JS, or under reduced motion, the timer never starts
and the control never appears, so it cannot advertise a pause for a carousel
that is not moving.

## Consumers

`src/components/FixturesStrip.astro` — the existing region and `<ul>` are
replaced by `<CardCarousel label="Match schedule" itemNoun="fixtures">`. The
`<li>` cards, the empty state and the countdown block above are unchanged.

`src/pages/index.astro` (First Team Squad section) — same swap, with
`label="Featured squad players" itemNoun="players"` and `autoplay`. The
"Full Squad" button below is unchanged.

Neither consumer changes what it renders, only what wraps it.

## Testing

`tests/e2e/carousel.spec.ts`:

- Next scrolls the fixtures track right, previous returns it. Asserted on
  `scrollLeft`, since that is the observable effect.
- Previous is disabled at the start; next is disabled at the end.
- Controls stay hidden when the content fits, which the two Playwright
  projects already express: on `desktop` the squad carousel's controls must
  be hidden (1040px of cards in 1112px of shell) while the fixtures
  carousel's are visible (1328px of cards); on `mobile` both are visible.
  Guard these with the project name so the desktop expectation does not run
  against Pixel 5.
- The squad carousel advances on its own within the autoplay interval.
- Hovering the squad carousel holds it still.

The hover test must move the pointer **off** the carousel to prove the
resume, then back. `tests/e2e/slider.spec.ts` records the lesson: with the
mouse resting on a control, `pointerleave` never fires, and the test cannot
tell `stop()` from `pause()` — it passes either way.

Reduced motion is asserted with Playwright's
`emulateMedia({ reducedMotion: 'reduce' })`: the track must not move and the
toggle must stay hidden.

`tests/e2e/accessibility.spec.ts` already runs axe over `/`, which covers the
`scrollable-region-focusable` rule on both carousels without a new case.

## Out of scope

Dot indicators. `HeroSlider` has them because it shows one slide at a time,
where "which of five" is meaningful. A carousel showing three-and-a-half
cards has no clean answer to that, and prev/next plus the native scrollbar
already convey position.

Converting `/fixtures` or `/squad`.
