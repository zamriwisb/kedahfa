# Card Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the homepage's fixtures strip visible previous/next controls, and the First Team Squad strip the same plus autoplay that pauses on hover.

**Architecture:** One new slot component, `CardCarousel.astro`, wraps an existing `snap-x` card list in a scroll region and adds controls. Its inline script initialises every instance on the page, reveals controls only when the track actually overflows, and runs autoplay for instances that opt in. `HeroSlider.astro` is not touched.

**Tech Stack:** Astro 7 components, Tailwind v4 utilities with CSS custom-property tokens, vanilla TypeScript in an Astro inline `<script>`, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-07-26-card-carousel-design.md`

## Global Constraints

- The scroll region keeps `tabindex="0" role="region" aria-label={label}`. A scrollable region a mouse can pan but a keyboard cannot reach fails WCAG 2.1.1 (axe rule `scrollable-region-focusable`). This was fixed once already; it must not regress.
- Controls render with the `hidden` attribute and are revealed by script only when `track.scrollWidth > track.clientWidth`. Without JS the section must stay exactly the scroll strip it is today.
- The autoplay pause/play toggle stays `hidden` until the timer actually starts, so it never advertises a mechanism that does not exist.
- Autoplay never starts under `prefers-reduced-motion: reduce`.
- Deliberate interaction *stops* autoplay for the page view rather than pausing it. A vertical wheel does not count as interaction — only a horizontal one.
- Colours come from the tokens in `src/styles/tokens.css`. Never hardcode a hex value. The brand yellow `--color-accent` is a light colour valid **on green only**.
- Surface-dependent styling follows the existing `on?: 'light' | 'green'` prop convention from `SectionHeading.astro:18`.
- Commit messages use conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `test:`) and end with the trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- The repo has unrelated uncommitted changes in `src/components/`, `src/pages/`, `src/layouts/`, `src/styles/` and untracked files at the repo root. Stage only the paths each task names. Never run `git add -A` or `git add .`.

## Layout arithmetic these tasks depend on

The shell is `--container-6xl` (72rem = 1152px) less two `--spacing-gutter` (1.25rem) gutters → **1112px of content** once the viewport is that wide.

| Carousel | Cards | Card width | Track width | Overflows 1112px? |
|---|---|---|---|---|
| Fixtures | 4 | `sm:w-80` = 320px | 4×320 + 3×16 = **1328px** | Yes |
| Squad | 6 | `w-40` = 160px | 6×160 + 5×16 = **1040px** | No |

Playwright's `desktop` project is Desktop Chrome (1280px wide); `mobile` is Pixel 5 (393px, ~353px of content, where both overflow). This is why the squad carousel's controls are expected hidden on desktop and visible on mobile.

---

### Task 1: CardCarousel component and the fixtures carousel

Builds the component and wires the first consumer, which uses controls only. Autoplay markup is included (the component needs one code path) but no consumer enables it until Task 2.

**Files:**
- Create: `src/components/CardCarousel.astro`
- Modify: `src/components/FixturesStrip.astro:58-77`
- Test: `tests/e2e/carousel.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `CardCarousel.astro` with props `label: string`, `itemNoun: string`, `autoplay?: boolean` (default `false`), `on?: 'light' | 'green'` (default `'light'`). It renders the scroll region and the `<ul class="flex snap-x gap-4 pb-2">`; the default slot supplies `<li>` cards carrying their own width classes. Task 2 uses `autoplay` and `on="green"`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/carousel.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const FIXTURES = '.card-carousel[data-carousel="fixtures"]';

test('the fixtures carousel exposes previous and next controls', async ({ page }) => {
  await page.goto('/');

  // 4 cards at 320px overflow the 1112px shell on desktop and the ~353px
  // Pixel 5 shell alike, so the controls show on both projects.
  await expect(page.getByRole('button', { name: 'Next fixtures' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeVisible();
});

test('previous is disabled at the start of the track', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeDisabled();
});

test('next scrolls the fixtures track and previous brings it back', async ({ page }) => {
  await page.goto('/');

  const track = page.locator(`${FIXTURES} .card-carousel__track`);
  await expect(track).toHaveJSProperty('scrollLeft', 0);

  await page.getByRole('button', { name: 'Next fixtures' }).click();
  // scrollLeft is the observable effect of paging; poll because the scroll is
  // smooth, so it is not final on the click's next tick.
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });

  // Previous becomes usable the moment the track leaves its start.
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeEnabled();

  await page.getByRole('button', { name: 'Previous fixtures' }).click();
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
  }).toPass({ timeout: 5000 });
});

test('the scroll region is reachable by keyboard', async ({ page }) => {
  await page.goto('/');

  // WCAG 2.1.1: a region a mouse can pan must be focusable too.
  await expect(page.locator(`${FIXTURES} .card-carousel__track`)).toHaveAttribute('tabindex', '0');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx playwright test tests/e2e/carousel.spec.ts
```

Expected: FAIL — every case errors because no `Next fixtures` button and no `.card-carousel` element exist yet.

- [ ] **Step 3: Create the component**

Create `src/components/CardCarousel.astro`:

```astro
---
interface Props {
  /** The scroll region's accessible name, e.g. "Match schedule". */
  label: string;
  /**
   * Noun the control names are built from, e.g. "fixtures" gives
   * "Previous fixtures". Separate from `label` because a single derived
   * string produces names like "Previous Match schedule" — cb20236 was a fix
   * for exactly that class of mislabelled control.
   */
  itemNoun: string;
  /** Whether this carousel advances on its own. */
  autoplay?: boolean;
  /**
   * Which surface the carousel sits on, following SectionHeading's
   * convention. The controls must read against the light page AND the green
   * band, and the two need different colours to do it.
   */
  on?: 'light' | 'green';
  /** Stable hook for tests, e.g. "fixtures". */
  name: string;
}

const { label, itemNoun, autoplay = false, on = 'light', name } = Astro.props;

const buttonClass =
  on === 'green'
    ? 'border-(--color-text-invert)/40 text-(--color-text-invert) hover:bg-(--color-text-invert) hover:text-(--color-brand-panel)'
    : 'border-(--color-line) text-(--color-action) hover:bg-(--color-action) hover:text-(--color-text-invert)';
---

<div
  class="card-carousel"
  data-carousel={name}
  data-item-noun={itemNoun}
  data-autoplay={autoplay ? 'true' : undefined}
>
  {
    /*
     * The region is focusable on purpose: a scrollable region a mouse can pan
     * but a keyboard cannot reach fails WCAG 2.1.1 (axe:
     * scrollable-region-focusable). The controls below are an addition to
     * this, never a replacement for it.
     */
  }
  <div class="card-carousel__track overflow-x-auto" tabindex="0" role="region" aria-label={label}>
    <ul class="flex snap-x gap-4 pb-2">
      <slot />
    </ul>
  </div>

  {
    /*
     * Rendered hidden and revealed by the script only when the track actually
     * overflows. Without JS the section stays the plain scroll strip it was,
     * and a carousel whose cards already fit never shows controls that would
     * scroll it by nothing.
     */
  }
  <div
    class="card-carousel__controls mt-6 flex items-center justify-end gap-3"
    role="group"
    aria-label={`${label} controls`}
    hidden
  >
    {
      autoplay && (
        <button
          type="button"
          class={`card-carousel__toggle inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${buttonClass}`}
          aria-label={`Pause ${itemNoun} carousel`}
          hidden
        >
          <svg
            class="card-carousel__toggle-icon-pause h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="4" y="3" width="4" height="14" />
            <rect x="12" y="3" width="4" height="14" />
          </svg>
          <svg
            class="card-carousel__toggle-icon-play hidden h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M5 3l12 7-12 7V3Z" />
          </svg>
        </button>
      )
    }

    <button
      type="button"
      class={`card-carousel__prev inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40 ${buttonClass}`}
      aria-label={`Previous ${itemNoun}`}
      disabled
    >
      <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true" focusable="false">
        <path d="M12.5 3.5 6 10l6.5 6.5 1.4-1.4L8.8 10l5.1-5.1z" />
      </svg>
    </button>

    <button
      type="button"
      class={`card-carousel__next inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-40 ${buttonClass}`}
      aria-label={`Next ${itemNoun}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true" focusable="false">
        <path d="M7.5 3.5 6.1 4.9 11.2 10l-5.1 5.1 1.4 1.4L14 10z" />
      </svg>
    </button>
  </div>
</div>

<style>
  /* The controls are the affordance; the native bar would double up on it. */
  .card-carousel__track {
    scrollbar-width: none;
  }

  .card-carousel__track::-webkit-scrollbar {
    display: none;
  }
</style>

<script>
  const AUTOPLAY_MS = 6000;

  for (const root of document.querySelectorAll<HTMLElement>('.card-carousel')) {
    const track = root.querySelector<HTMLElement>('.card-carousel__track');
    const controls = root.querySelector<HTMLElement>('.card-carousel__controls');
    const prev = root.querySelector<HTMLButtonElement>('.card-carousel__prev');
    const next = root.querySelector<HTMLButtonElement>('.card-carousel__next');
    const cards = [...root.querySelectorAll<HTMLElement>('.card-carousel__track > ul > li')];
    const toggle = root.querySelector<HTMLButtonElement>('.card-carousel__toggle');
    const toggleIcons = toggle && {
      pause: toggle.querySelector<SVGElement>('.card-carousel__toggle-icon-pause'),
      play: toggle.querySelector<SVGElement>('.card-carousel__toggle-icon-play'),
    };

    if (!track || !controls || !prev || !next || cards.length === 0) continue;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantsAutoplay = root.dataset.autoplay === 'true';

    let timer: ReturnType<typeof setInterval> | null = null;
    // Autoplay that was never asked for, or is suppressed by reduced motion,
    // starts life already stopped so nothing below can start it.
    let stopped = reduceMotion || !wantsAutoplay;
    let atStart = true;
    let atEnd = false;

    // The +1 absorbs sub-pixel rounding: a track whose content matches its box
    // to within a fraction of a pixel is not scrollable in practice, and
    // without the slack it would show controls that move nothing.
    const overflows = () => track.scrollWidth > track.clientWidth + 1;

    // Declared before syncControls, which calls it. These are `const` arrow
    // functions, so a call that runs before its definition is a TDZ
    // ReferenceError, not a hoisted no-op — 05e889f was a fix for exactly
    // that in the countdown island.
    const pause = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const syncControls = () => {
      const scrollable = overflows();
      controls.hidden = !scrollable;
      prev.disabled = !scrollable || atStart;
      next.disabled = !scrollable || atEnd;
      // A track that cannot scroll must not keep a timer running against it.
      if (!scrollable) pause();
    };

    const page = (direction: 1 | -1) => {
      track.scrollBy({
        left: direction * track.clientWidth,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    };

    // The single owner of both the stopped flag and the toggle's presentation,
    // so every call site that ends or resumes autoplay updates the button the
    // same way instead of duplicating it. The noun comes from the data
    // attribute rather than by parsing the current label back apart.
    const itemNoun = root.dataset.itemNoun ?? 'carousel';
    const setStopped = (value: boolean) => {
      stopped = value;
      if (!toggle || !toggleIcons) return;
      toggle.setAttribute('aria-label', `${value ? 'Play' : 'Pause'} ${itemNoun} carousel`);
      toggleIcons.pause?.classList.toggle('hidden', value);
      toggleIcons.play?.classList.toggle('hidden', !value);
    };

    const start = () => {
      if (stopped || timer !== null || !overflows()) return;
      timer = setInterval(() => {
        // Wrap rather than stall once the last card is in view.
        if (atEnd) track.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        else page(1);
      }, AUTOPLAY_MS);
      // Only unhidden once the timer actually exists: without this script, or
      // under reduced motion, this line never runs, so the control never
      // claims a pause mechanism for a carousel that does not move.
      if (toggle) toggle.hidden = false;
    };

    // Deliberate interaction ends autoplay for this page view. Pausing would
    // not be enough: a card must never be yanked away from someone who chose
    // it and is reading it.
    const stop = () => {
      setStopped(true);
      pause();
    };

    // Which end the track sits at, observed rather than computed from scroll
    // events: a scroll listener fires for this script's own scrollBy() as
    // well as the visitor's gesture, so it cannot tell them apart — the
    // distinction stop-on-interaction depends on (see HeroSlider:327).
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === cards[0]) atStart = entry.isIntersecting;
          if (entry.target === cards[cards.length - 1]) atEnd = entry.isIntersecting;
        }
        syncControls();
      },
      { root: track, threshold: 0.99 },
    );
    observer.observe(cards[0]);
    observer.observe(cards[cards.length - 1]);

    prev.addEventListener('click', () => {
      stop();
      page(-1);
    });
    next.addEventListener('click', () => {
      stop();
      page(1);
    });

    toggle?.addEventListener('click', () => {
      if (stopped) {
        setStopped(false);
        start();
      } else {
        stop();
      }
    });

    for (const eventName of ['pointerdown', 'touchstart'] as const) {
      track.addEventListener(eventName, stop, { passive: true });
    }

    // A vertical wheel is the visitor scrolling the PAGE with the cursor
    // resting over the carousel, not driving the track. Only a sideways
    // gesture is an interaction with this component.
    track.addEventListener(
      'wheel',
      (event) => {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        stop();
      },
      { passive: true },
    );

    root.addEventListener('pointerenter', pause);
    root.addEventListener('pointerleave', start);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else start();
    });

    // Whether the track overflows depends on the viewport, so the controls
    // have to be re-evaluated when it changes — this is what makes the squad
    // carousel show controls on a phone and hide them on a wide desktop.
    new ResizeObserver(syncControls).observe(track);

    syncControls();
    start();
  }
</script>
```

- [ ] **Step 4: Wire the fixtures strip to it**

In `src/components/FixturesStrip.astro`, add the import below the existing ones at the top of the frontmatter:

```astro
import CardCarousel from './CardCarousel.astro';
```

Then replace the region block (currently lines 58-77, the `strip.length > 0 ? (...) : (...)` expression) with:

```astro
    {
      strip.length > 0 ? (
        <CardCarousel name="fixtures" label="Match schedule" itemNoun="fixtures">
          {strip.map((match) => (
            <li class="w-72 shrink-0 snap-start sm:w-80">
              <MatchRow
                match={match}
                teamsBySlug={teamsBySlug}
                clubSlug={clubSlug}
                highlight={next?.id === match.id}
              />
            </li>
          ))}
        </CardCarousel>
      ) : (
        <EmptyState message="No fixtures are currently scheduled." />
      )
    }
```

The `<li>` contents, the empty state and the countdown block above are unchanged — only the wrapper differs.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx playwright test tests/e2e/carousel.spec.ts
```

Expected: PASS, 8 cases (4 × 2 projects).

If a stray dev server is listening on port 4321, Playwright's `reuseExistingServer: !process.env.CI` silently reuses it and injects the Astro Dev Toolbar, which causes unrelated failures. Run `npx astro dev stop` first if `astro dev status` reports one running.

- [ ] **Step 6: Check types and the rest of the suite**

```bash
npx astro check
npx playwright test
```

Expected: `astro check` reports 0 errors, 0 warnings, 0 hints. Full Playwright run passes — `accessibility.spec.ts` runs axe over `/`, which is what proves the focusable-region rule still holds.

- [ ] **Step 7: Commit**

```bash
git add src/components/CardCarousel.astro src/components/FixturesStrip.astro tests/e2e/carousel.spec.ts
git commit -m "$(cat <<'EOF'
feat: add previous/next controls to the homepage fixtures strip

CardCarousel wraps an existing snap-x card list and adds paging controls.
They render hidden and are revealed only when the track actually overflows,
so without JS the section stays the plain scroll strip it was, and a
carousel whose cards already fit never shows controls that move nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Autoplay on the First Team Squad carousel

Wires the second consumer with `autoplay` and the green surface treatment, and covers the autoplay behaviour.

**Files:**
- Modify: `src/pages/index.astro:115-129`
- Test: `tests/e2e/carousel.spec.ts` (append)

**Interfaces:**
- Consumes: `CardCarousel.astro` from Task 1, with props `label`, `itemNoun`, `autoplay`, `on`, `name`. Its script already reads `data-autoplay="true"` and runs the timer; this task only supplies a consumer that sets it.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/carousel.spec.ts`:

```ts
const SQUAD = '.card-carousel[data-carousel="squad"]';

test('the squad carousel advances on its own', async ({ page }, testInfo) => {
  // 6 cards at 160px fit the 1112px desktop shell, so there is nothing to
  // autoplay there. Pixel 5 is where the track actually overflows.
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);
  await expect(track).toHaveJSProperty('scrollLeft', 0);

  // Autoplay is 6s; allow one interval plus the smooth scroll.
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('hovering the squad carousel holds it still', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);

  // Hover without clicking: this must PAUSE, not stop.
  await track.hover();
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

  // Moving off must resume. Without this half the test cannot tell a pause
  // from a stop — slider.spec.ts records the same lesson.
  await page.mouse.move(0, 0);
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('the squad carousel offers a pause control that stops it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');

  // WCAG 2.2.2: auto-moving content needs a discoverable way to stop it.
  const pauseButton = page.getByRole('button', { name: 'Pause players carousel' });
  await expect(pauseButton).toBeVisible();

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play players carousel' })).toBeVisible();

  // Off the control, so the durable stopped state is what is measured rather
  // than the transient hover-pause.
  await page.mouse.move(0, 0);
  const track = page.locator(`${SQUAD} .card-carousel__track`);
  const resting = await track.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(resting);
});

test('a carousel whose cards already fit shows no controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the squad track only fits on desktop');

  await page.goto('/');

  // 6 × 160px + 5 × 16px = 1040px inside 1112px of shell: nothing to page
  // through, so the controls must stay hidden rather than move nothing.
  await expect(page.locator(`${SQUAD} .card-carousel__controls`)).toBeHidden();
  // The fixtures track on the same page does overflow, which proves the
  // hidden state above is a real measurement and not a broken selector.
  await expect(page.locator(`${FIXTURES} .card-carousel__controls`)).toBeVisible();
});

test('reduced motion suppresses autoplay and its pause control', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const track = page.locator(`${SQUAD} .card-carousel__track`);
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

  // The toggle is only unhidden when the timer starts, so it must not appear.
  await expect(page.locator(`${SQUAD} .card-carousel__toggle`)).toBeHidden();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx playwright test tests/e2e/carousel.spec.ts
```

Expected: FAIL — the squad section has no `.card-carousel[data-carousel="squad"]` yet, so the locators find nothing and no `Pause players carousel` button exists.

- [ ] **Step 3: Wire the squad section**

In `src/pages/index.astro`, add the import alongside the existing component imports:

```astro
import CardCarousel from '../components/CardCarousel.astro';
```

Then replace the `featuredPlayers.length > 0 ? (...) : (...)` block (currently lines 115-129) with:

```astro
      {
        featuredPlayers.length > 0 ? (
          <CardCarousel
            name="squad"
            label="Featured squad players"
            itemNoun="players"
            on="green"
            autoplay
          >
            {featuredPlayers.map((player) => (
              <li class="w-40 shrink-0 snap-start">
                <PlayerCard player={player} />
              </li>
            ))}
          </CardCarousel>
        ) : (
          <EmptyState message="The squad list will be published shortly." />
        )
      }
```

The "Full Squad" button below is unchanged.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx playwright test tests/e2e/carousel.spec.ts
```

Expected: PASS. The autoplay, hover, pause-control and reduced-motion cases run on `mobile` and skip on `desktop`; the fits-without-controls case does the reverse.

- [ ] **Step 5: Check types and the whole suite**

```bash
npx astro check
npm test
npx playwright test
```

Expected: `astro check` 0 errors/warnings/hints. `npm test` passes (unchanged by this task — it touches no data or lib code). Full Playwright run passes, including axe over the homepage with both carousels present.

- [ ] **Step 6: Verify the green surface by eye**

```bash
npx astro dev --background --port 4322
```

Open `http://localhost:4322/` and confirm on the First Team Squad band that the control borders and glyphs are legible against `--color-brand-panel`, and that hovering inverts them cleanly. axe cannot judge this: it resolves contrast from the nearest ancestor's `background-color`, which is why the HeroSlider scrim needed checking by eye too. Stop the server with `npx astro dev stop` when done.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro tests/e2e/carousel.spec.ts
git commit -m "$(cat <<'EOF'
feat: autoplay the First Team Squad carousel

Advances every 6s, pausing while the pointer is over it or focus is inside
it, and stopping outright once the visitor takes control — a card must not
be yanked away from someone reading it. A pause/play toggle accompanies it
because hover covers neither keyboard nor touch, and WCAG 2.2.2 requires a
discoverable way to stop auto-moving content.

Six cards fit the desktop shell, so there the track does not overflow and
neither autoplay nor the controls engage.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification

After both tasks:

```bash
npx astro check     # 0 errors, 0 warnings, 0 hints
npm test            # unit suite, unaffected but must stay green
npx playwright test # full e2e including axe over the homepage
```

Manual check with `npx astro dev --background --port 4322`: the fixtures strip pages left and right with its controls disabling at each end; the squad band advances on its own on a narrow window, stops when clicked, and its pause control flips to Play; widening the window past ~1150px hides the squad controls entirely while the fixtures controls remain.
