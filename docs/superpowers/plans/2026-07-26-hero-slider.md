# Hero Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the computed match hero on the homepage with a full-width, curated slider whose slides are edited in `src/data/slides.yaml`.

**Architecture:** Slides are an Astro content collection loaded from YAML, validated by Zod at build time and sorted by a small pure helper. A single `HeroSlider.astro` component renders them into a horizontal scroll-snap track — so touch swipe and no-JS behaviour come from the browser — and an inline `<script>` layers autoplay and indicator syncing on top.

**Tech Stack:** Astro 7, Tailwind CSS v4 (`@theme` tokens in `src/styles/tokens.css`), Zod via `astro/zod`, Vitest for unit tests, Playwright + axe for e2e.

Design spec: `docs/superpowers/specs/2026-07-26-hero-slider-design.md`

## Global Constraints

- **No new dependencies.** No carousel library. Interactivity is an inline `<script>` in the `.astro` component, matching `src/components/islands/MobileNav.astro` and `Countdown.astro`.
- **No raw hex colours anywhere outside `src/styles/tokens.css`.** Use the CSS custom properties, e.g. `bg-(--color-brand-ink)`, `text-(--color-text-invert)`.
- **Tailwind v4 paren syntax for custom properties** — `bg-(--color-action)`, never `bg-[--color-action]` or `bg-[var(--color-action)]`.
- **Every text node over the photo sets an explicit invert text colour.** The axe e2e check resolves effective background from the nearest ancestor's CSS `background-color`, not from an absolutely positioned image or gradient. A dark section background with no explicit text colour previously produced a 1.42:1 failure in `HeroPanel`. This is not optional styling.
- **`imageAlt` is required, never optional.** Accessibility must not be droppable by omission — same rule the `news` collection already applies.
- **Commands:** `npm test` (vitest), `npm run build` (`astro check && astro build`), `npm run test:e2e` (Playwright, builds and previews first).
- Dev server, if needed: `astro dev --background`, managed with `astro dev status` / `astro dev logs` / `astro dev stop`.

## File Structure

**Created**

| Path                                | Responsibility                                              |
| ----------------------------------- | ----------------------------------------------------------- |
| `src/lib/slides.ts`                 | `Slide` type + `sortSlides()`. Pure, unit-testable.          |
| `src/data/slides.yaml`              | The slide content itself.                                    |
| `src/components/HeroSlider.astro`   | Markup, styling and behaviour of the slider.                 |
| `public/images/slides/.gitkeep`     | Home for real slide photography.                             |
| `tests/unit/slides.test.ts`         | Sorting rules.                                               |
| `tests/e2e/slider.spec.ts`          | Rendering and dash interaction in a real browser.            |

**Modified**

| Path                             | Change                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `src/content.config.ts`          | Add the `slides` collection + schema.                          |
| `src/lib/content.ts`             | Load, sort and expose `slides`; add slide images to the asset check. |
| `src/pages/index.astro`          | Swap `HeroPanel` for `HeroSlider`.                             |
| `src/lib/fixtures.ts`            | Delete `selectHero`, `Hero`, `HERO_RESULT_WINDOW_DAYS`, `MS_PER_DAY`. |
| `tests/unit/fixtures.test.ts`    | Delete the `selectHero` describe block and import.             |
| `tests/unit/build-negative.test.ts` | Two new cases for slide validation.                         |

**Deleted**

- `src/components/HeroPanel.astro`

**Note on where `Slide` lives:** the spec says the interface sits in `src/lib/content.ts` next to `Article`. Follow this plan instead and declare it in `src/lib/slides.ts`, imported into `content.ts` as a type. That matches how `Match` (`lib/fixtures.ts`) and `Player` (`lib/squad.ts`) already work — the type lives with the logic that operates on it.

---

### Task 1: Slides data layer

Build the collection, the schema, the sort helper, the seed content and the build-time validation. At the end of this task nothing renders yet, but bad slide content already fails the build.

**Files:**
- Create: `src/lib/slides.ts`
- Create: `tests/unit/slides.test.ts`
- Create: `src/data/slides.yaml`
- Create: `public/images/slides/.gitkeep`
- Modify: `src/content.config.ts` (add collection, register in the `collections` export at the bottom)
- Modify: `src/lib/content.ts` (import, `SiteData` field, `getCollection` call, mapping, asset check, return)
- Modify: `tests/unit/build-negative.test.ts` (append two cases before the closing `});`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface Slide { id: string; image: string; imageAlt: string; eyebrow?: string; title: string; href?: string; cta?: string; order?: number }` exported from `src/lib/slides.ts`
  - `function sortSlides(slides: Slide[]): Slide[]` exported from `src/lib/slides.ts`
  - `SiteData.slides: Slide[]` returned by `loadSiteData()` in `src/lib/content.ts`

- [ ] **Step 1: Write the failing sort tests**

Create `tests/unit/slides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sortSlides, type Slide } from '../../src/lib/slides';

const slide = (id: string, order?: number): Slide => ({
  id,
  image: '/images/slides/example.jpg',
  imageAlt: `${id} photo`,
  title: id,
  order,
});

const ids = (slides: Slide[]) => slides.map((s) => s.id);

describe('sortSlides', () => {
  it('orders slides by their order field, ascending', () => {
    expect(ids(sortSlides([slide('c', 3), slide('a', 1), slide('b', 2)]))).toEqual(['a', 'b', 'c']);
  });

  it('puts slides with no order after every slide that has one', () => {
    expect(ids(sortSlides([slide('plain'), slide('first', 1)]))).toEqual(['first', 'plain']);
  });

  it('keeps file order among slides that share an order value', () => {
    // Two slides both marked `order: 1` must not swap on every build — a
    // non-stable sort here would make the homepage's opening slide random.
    expect(ids(sortSlides([slide('x', 1), slide('y', 1), slide('z', 1)]))).toEqual(['x', 'y', 'z']);
  });

  it('keeps file order among slides that all lack an order', () => {
    expect(ids(sortSlides([slide('x'), slide('y'), slide('z')]))).toEqual(['x', 'y', 'z']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortSlides([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [slide('b', 2), slide('a', 1)];
    sortSlides(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/slides.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/slides"`.

- [ ] **Step 3: Write `src/lib/slides.ts`**

```ts
export interface Slide {
  id: string;
  /** Public-absolute path, e.g. "/images/slides/tickets.jpg". */
  image: string;
  /** Describes the photo, not the headline. Never optional. */
  imageAlt: string;
  /** Short line above the headline — a date or a label. */
  eyebrow?: string;
  title: string;
  href?: string;
  /** Button label. Meaningless without `href`; the schema enforces the pair. */
  cta?: string;
  order?: number;
}

/**
 * Ascending by `order`, with slides that have none falling after every slide
 * that does. Promoting one slide is then a single-line YAML edit rather than a
 * renumbering of the whole file.
 *
 * Array.prototype.sort is specified as stable in modern engines, but the
 * decorate-sort-undecorate below makes that guarantee explicit rather than
 * assumed: two slides sharing an order value must never swap between builds,
 * or the homepage's opening slide changes at random.
 */
export function sortSlides(slides: Slide[]): Slide[] {
  return slides
    .map((slide, index) => ({ slide, index }))
    .sort((a, b) => {
      const left = a.slide.order ?? Number.POSITIVE_INFINITY;
      const right = b.slide.order ?? Number.POSITIVE_INFINITY;
      return left === right ? a.index - b.index : left - right;
    })
    .map((entry) => entry.slide);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/slides.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the `slides` collection to `src/content.config.ts`**

Insert this block immediately after the `sponsors` collection and before `const news = defineCollection({`:

```ts
const slides = defineCollection({
  loader: file('src/data/slides.yaml'),
  schema: z
    .object({
      id: z.string(),
      // Deliberately "/images/" and not "/images/slides/": the seed slides
      // point at the shared placeholder in /images/news/ until real
      // photography arrives, and a slide may legitimately reuse a news photo.
      // assertPublicAssetsExist() is what actually guarantees the file is
      // there, so this prefix only rules out off-site and relative URLs.
      image: z.string().startsWith('/images/'),
      // Required, not optional: accessibility must not be droppable by omission.
      imageAlt: z.string().min(1),
      eyebrow: z.string().optional(),
      title: z.string().min(1),
      href: z.string().startsWith('/').optional(),
      cta: z.string().optional(),
      order: z.number().int().optional(),
    })
    .strict()
    .refine((slide) => slide.cta === undefined || slide.href !== undefined, {
      message: 'A slide with a "cta" label also needs an "href" for the button to link to.',
      path: ['cta'],
    }),
});
```

Then extend the export on the last line:

```ts
export const collections = { club, season, teams, fixtures, standings, squad, slides, sponsors, news };
```

- [ ] **Step 6: Create the seed content**

Create `src/data/slides.yaml`:

```yaml
# Slides are curated, not generated. Order is explicit so re-ordering is a
# one-line edit. Images point at the shared placeholder until real
# photography lands in /images/slides/ — swap the paths there, and the build
# will reject a typo rather than shipping a broken slide.
- id: season-tickets
  image: /images/news/placeholder.svg
  imageAlt: Supporters filling the stands at Darul Aman Stadium
  eyebrow: Season 2026/27
  title: Season tickets are on sale now
  href: /contact
  cta: Buy Tickets
  order: 1

- id: new-signing
  image: /images/news/placeholder.svg
  imageAlt: A new signing holding up a Kedah shirt
  eyebrow: Transfer news
  title: Kedah complete the signing of a new forward
  href: /news/new-signing-announced
  order: 2

- id: academy-trials
  image: /images/news/placeholder.svg
  imageAlt: Young players training on a grass pitch
  eyebrow: Academy
  title: Academy trials open for the 2027 intake
  href: /news/academy-trials-open
  order: 3
```

Create the empty asset directory:

```bash
mkdir -p public/images/slides && touch public/images/slides/.gitkeep
```

- [ ] **Step 7: Wire slides into `src/lib/content.ts`**

Add the import next to the other lib type imports at the top (after the `Player, Position` import line):

```ts
import { sortSlides, type Slide } from './slides';
```

Add the field to the `SiteData` interface, immediately after `sponsors: Sponsor[];`:

```ts
  slides: Slide[];
```

Add `getCollection('slides')` to the destructured `Promise.all` — the destructuring is positional, so the new name and the new call must both go last, after `newsEntries` / `getCollection('news', ...)`:

```ts
  const [
    teamEntries,
    fixtureEntries,
    standingEntries,
    squadEntries,
    sponsorEntries,
    newsEntries,
    slideEntries,
  ] = await Promise.all([
    getCollection('teams'),
    getCollection('fixtures'),
    getCollection('standings'),
    getCollection('squad'),
    getCollection('sponsors'),
    getCollection('news', ({ data }) => import.meta.env.DEV || !data.draft),
    getCollection('slides'),
  ]);
```

Add the mapping immediately after the `sponsors` mapping:

```ts
  const slides: Slide[] = sortSlides(
    slideEntries.map((e) => ({
      id: e.id,
      image: e.data.image,
      imageAlt: e.data.imageAlt,
      eyebrow: e.data.eyebrow,
      title: e.data.title,
      href: e.data.href,
      cta: e.data.cta,
      order: e.data.order,
    })),
  );
```

Add slide images to the existing `assertPublicAssetsExist` call:

```ts
  assertPublicAssetsExist(
    [
      ...teams.map((t) => t.crest),
      ...squad.map((p) => p.photo),
      ...sponsors.map((s) => s.logo),
      ...articles.map((a) => a.image),
      ...slides.map((s) => s.image),
    ],
    PUBLIC_DIR,
  );
```

And add `slides,` to the returned object, after `sponsors,`.

- [ ] **Step 8: Verify the build accepts the new collection**

Run: `npm run build`
Expected: exit 0. `astro check` reports 0 errors, and the build completes.

- [ ] **Step 9: Write the failing build-negative tests**

Append these two cases to `tests/unit/build-negative.test.ts`, inside the `describe('the real build rejects bad content')` block, just before its closing `});`:

```ts
  it(
    'fails a slide whose image is missing from public/',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        // Only the first occurrence is replaced, so exactly one slide breaks.
        (text) =>
          text.replace('image: /images/news/placeholder.svg', 'image: /images/slides/not-here.jpg'),
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
    'fails a slide that has a cta label but nothing to link it to',
    () => {
      withMutatedFile(
        'src/data/slides.yaml',
        // season-tickets is the only slide carrying both href and cta.
        (text) => text.replace('  href: /contact\n', ''),
        () => {
          const { status, output } = runBuild();
          expect(status).not.toBe(0);
          expect(output).toMatch(/also needs an "href"/);
        },
      );
    },
    BUILD_TIMEOUT_MS,
  );
```

- [ ] **Step 10: Run the new build-negative cases**

Run: `npx vitest run tests/unit/build-negative.test.ts -t slide`
Expected: PASS, 2 tests. Each spawns a full `npm run build`, so allow ~1 minute.

If a case fails with exit status 0, the validation it targets is not wired up — go back to Step 5 or Step 7 rather than weakening the assertion.

- [ ] **Step 11: Confirm the data files were restored**

Run: `git diff --stat src/data/slides.yaml`
Expected: no output. `withMutatedFile` restores the file in a `finally` block; any diff here means a test crashed mid-run and the seed content must be restored by hand before continuing.

- [ ] **Step 12: Run the whole unit suite**

Run: `npm test`
Expected: PASS, all files.

- [ ] **Step 13: Commit**

```bash
git add src/lib/slides.ts src/data/slides.yaml src/content.config.ts src/lib/content.ts \
        public/images/slides/.gitkeep tests/unit/slides.test.ts tests/unit/build-negative.test.ts
git commit -m "feat: add the slides content collection"
```

---

### Task 2: HeroSlider component and homepage swap

Render the slides. No JavaScript in this task — at the end of it the slider is a working, swipeable, keyboard-scrollable gallery, and `HeroPanel` is gone.

**Files:**
- Create: `src/components/HeroSlider.astro`
- Create: `tests/e2e/slider.spec.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/lib/fixtures.ts`
- Modify: `tests/unit/fixtures.test.ts`
- Delete: `src/components/HeroPanel.astro`

**Interfaces:**
- Consumes: `Slide` and `SiteData.slides` from Task 1.
- Produces: `HeroSlider.astro` accepting `Props { slides: Slide[] }`. Task 3's script depends on these exact hooks in its output: root class `hero-slider`, scroll container class `hero-slider__track`, each slide `<li class="hero-slider__slide">`, each indicator `<button data-slide-to="N" class="hero-slider__dot">`.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/slider.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('the homepage opens with the slider', async ({ page }) => {
  await page.goto('/');

  const slider = page.locator('.hero-slider');
  await expect(slider).toBeVisible();
  await expect(slider.locator('.hero-slider__slide')).toHaveCount(3);
});

test('the first slide shows its headline and call to action', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Season tickets are on sale now' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Buy Tickets' })).toBeVisible();
});

test('every slide names its own position in the set', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.hero-slider__slide').first()).toHaveAttribute('aria-label', '1 of 3');
  await expect(page.locator('.hero-slider__slide').last()).toHaveAttribute('aria-label', '3 of 3');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/slider.spec.ts --project=desktop`
Expected: FAIL — `.hero-slider` never becomes visible (strict-mode / timeout error). The first run builds the site, so allow a minute.

- [ ] **Step 3: Write `src/components/HeroSlider.astro`**

```astro
---
import type { Slide } from '../lib/slides';

interface Props {
  slides: Slide[];
}

const { slides } = Astro.props;
const total = slides.length;
---

{
  /*
   * The track is a scroll-snap container rather than a JS-swapped stack of
   * absolutely positioned slides. Touch swipe, momentum and keyboard
   * scrolling then come from the browser, and the script in this file only
   * *adds* autoplay and indicator syncing on top. If that script fails to
   * run, this is still a working gallery instead of a dead single frame.
   *
   * The section keeps its own solid --color-brand-ink background behind the
   * photo, and every text node below sets an explicit invert colour. axe
   * resolves a text node's effective background from the nearest ancestor's
   * CSS background-color — never from an absolutely-positioned image or
   * gradient — so a dark section with no explicit text colour reads as a
   * contrast failure (measured 1.42:1 in the HeroPanel this replaces).
   */
}
{
  total > 0 && (
    <section
      class="hero-slider relative isolate bg-(--color-brand-ink)"
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      <div
        class="hero-slider__track overflow-x-auto overscroll-x-contain snap-x snap-mandatory"
        tabindex="0"
        role="region"
        aria-label="Featured slides"
      >
        <ul class="flex">
          {slides.map((slide, index) => (
            <li
              class="hero-slider__slide relative flex min-h-[420px] w-full shrink-0 snap-start flex-col justify-end overflow-hidden sm:min-h-[540px] lg:min-h-[620px]"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${total}`}
            >
              <img
                src={slide.image}
                alt={slide.imageAlt}
                width="1600"
                height="900"
                loading={index === 0 ? 'eager' : 'lazy'}
                class="absolute inset-0 -z-10 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                class="absolute inset-0 -z-10 bg-gradient-to-t from-(--color-brand-ink) via-(--color-brand-ink)/60 to-transparent"
              />

              <div class="relative mx-auto w-full max-w-6xl px-(--spacing-gutter) pb-20 pt-24">
                {slide.eyebrow && (
                  <p class="text-sm tracking-widest text-(--color-text-invert) font-display">
                    {slide.eyebrow}
                  </p>
                )}

                <h2 class="mt-2 max-w-3xl text-4xl leading-[0.95] text-(--color-text-invert) sm:text-6xl lg:text-7xl">
                  {slide.href ? (
                    <a
                      href={slide.href}
                      class="text-(--color-text-invert) transition-colors hover:text-(--color-accent)"
                    >
                      {slide.title}
                    </a>
                  ) : (
                    slide.title
                  )}
                </h2>

                {slide.cta && slide.href && (
                  <a
                    href={slide.href}
                    class="clip-corner mt-6 inline-flex bg-(--color-action) px-6 text-sm tracking-widest text-(--color-text-invert) transition-colors font-display hover:bg-(--color-action-deep)"
                  >
                    {slide.cta}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {total > 1 && (
        <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div class="mx-auto flex max-w-6xl justify-end px-(--spacing-gutter) pb-4">
            <div class="pointer-events-auto flex gap-2" role="group" aria-label="Choose a slide">
              {slides.map((slide, index) => (
                <button
                  type="button"
                  class="hero-slider__dot justify-center px-1"
                  data-slide-to={index}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === 0 ? 'true' : undefined}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

<style>
  /*
   * Two things Tailwind utilities cannot express cleanly, kept together here:
   * hiding the track's scrollbar (the dashes are the affordance) and styling
   * the dash from its own aria-current, so the DOM attribute the script sets
   * is the single source of truth for which dash is active.
   */
  .hero-slider__track {
    scrollbar-width: none;
  }

  .hero-slider__track::-webkit-scrollbar {
    display: none;
  }

  .hero-slider__dot span {
    display: block;
    height: 3px;
    width: 2rem;
    background-color: rgb(255 255 255 / 45%);
    transition: background-color 150ms ease;
  }

  .hero-slider__dot[aria-current='true'] span {
    background-color: var(--color-accent);
  }
</style>
```

Note on the dash buttons: `global.css` already gives every `button` `min-height: 44px` and `display: inline-flex`, so each dash clears the target-size minimum without extra classes.

- [ ] **Step 4: Swap the component into `src/pages/index.astro`**

Remove these three lines:

```astro
import HeroPanel from '../components/HeroPanel.astro';
import { selectHero } from '../lib/fixtures';
const hero = selectHero(matches, now);
```

Add the import alongside the other component imports (alphabetically, after `FixturesStrip`):

```astro
import HeroSlider from '../components/HeroSlider.astro';
```

Add `slides` to the destructured `loadSiteData()` result:

```astro
const { club, teamsBySlug, matches, standings, squad, sponsors, articles, slides } = await loadSiteData();
```

Replace the `<HeroPanel ... />` line with:

```astro
  <HeroSlider slides={slides} />
```

`now` stays — `FixturesStrip` still uses it.

- [ ] **Step 5: Delete `HeroPanel` and its now-unreachable helpers**

```bash
git rm src/components/HeroPanel.astro
```

In `src/lib/fixtures.ts`, delete these, which now have no callers at all:

- the `HERO_RESULT_WINDOW_DAYS` export and its doc comment (`/** How recent a result must be to outrank the next fixture on the homepage. */`)
- `const MS_PER_DAY = 86_400_000;` — used only by `selectHero`
- `export type Hero = ...`
- the whole `selectHero` function and the doc comment above it

Everything else stays: `upcomingMatches`, `finishedMatches`, `awaitingResult`, `nextMatch`, `recentResults`, `outcomeFor`, `groupByMonth` all have other callers.

In `tests/unit/fixtures.test.ts`, remove `selectHero,` from the import list at the top and delete the entire `describe('selectHero', () => { ... });` block.

- [ ] **Step 6: Verify nothing still references the deleted symbols**

Run: `grep -rn "HeroPanel\|selectHero\|HERO_RESULT_WINDOW_DAYS\|MS_PER_DAY" src tests`
Expected: no output.

- [ ] **Step 7: Build and run the unit suite**

Run: `npm run build && npm test`
Expected: both exit 0. `astro check` catches an unused import or a stale reference here if Step 5 was incomplete.

- [ ] **Step 8: Run the e2e slider tests**

Run: `npx playwright test tests/e2e/slider.spec.ts`
Expected: PASS on both the `desktop` and `mobile` projects — 6 results.

- [ ] **Step 9: Run the accessibility suite**

Run: `npx playwright test tests/e2e/accessibility.spec.ts`
Expected: PASS. `/` must report zero violations.

If a contrast violation appears on `/`, the fix is an explicit `text-(--color-text-invert)` on the offending node — not a change to the axe tags or an exclusion.

- [ ] **Step 10: Commit**

```bash
# The HeroPanel deletion was already staged by `git rm` in Step 5.
git add src/components/HeroSlider.astro src/pages/index.astro src/lib/fixtures.ts \
        tests/e2e/slider.spec.ts tests/unit/fixtures.test.ts
git commit -m "feat: open the homepage with a full-width hero slider"
```

---

### Task 3: Autoplay, indicators and keyboard control

Layer behaviour onto the working static slider.

**Files:**
- Modify: `src/components/HeroSlider.astro` (append a `<script>` block after the `<style>` block)
- Modify: `tests/e2e/slider.spec.ts` (append interaction tests)

**Interfaces:**
- Consumes: the DOM hooks Task 2 produced — `.hero-slider`, `.hero-slider__track`, `.hero-slider__slide`, `.hero-slider__dot[data-slide-to]`.
- Produces: no exported API. Behaviour is observable only through the DOM: the active dash carries `aria-current="true"` and no other dash does.

- [ ] **Step 1: Write the failing interaction tests**

Append to `tests/e2e/slider.spec.ts`:

```ts
test('clicking a dash moves to that slide', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Go to slide 3' }).click();

  await expect(page.getByRole('button', { name: 'Go to slide 3' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Go to slide 1' })).not.toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(page.locator('.hero-slider__slide').nth(2)).toBeInViewport();
});

test('the arrow keys move through the slides', async ({ page }) => {
  await page.goto('/');

  await page.locator('.hero-slider__track').focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('autoplay advances the slider on its own', async ({ page }) => {
  await page.goto('/');

  // Autoplay is 6s per slide; give it one full cycle plus the smooth scroll.
  await expect(page.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute(
    'aria-current',
    'true',
    { timeout: 12_000 },
  );
});

test('autoplay stops once the visitor takes control', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Go to slide 2' }).click();
  await expect(page.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  // A slide must never be yanked away from someone reading it: well past one
  // autoplay interval, slide 2 is still the active one.
  await page.waitForTimeout(9000);
  await expect(page.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test tests/e2e/slider.spec.ts --project=desktop`
Expected: the three original tests PASS; the four new ones FAIL — `aria-current` never moves off slide 1.

- [ ] **Step 3: Add the script to `src/components/HeroSlider.astro`**

Append after the `<style>` block:

```astro
<script>
  const AUTOPLAY_MS = 6000;

  for (const root of document.querySelectorAll<HTMLElement>('.hero-slider')) {
    const track = root.querySelector<HTMLElement>('.hero-slider__track');
    const slides = [...root.querySelectorAll<HTMLElement>('.hero-slider__slide')];
    const dots = [...root.querySelectorAll<HTMLButtonElement>('.hero-slider__dot')];

    // One slide needs no timer, no observer and no listeners.
    if (!track || slides.length < 2) continue;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let current = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    // Reduced motion means autoplay never starts in the first place.
    let stopped = reduceMotion;

    const goTo = (index: number) => {
      current = (index + slides.length) % slides.length;
      // Every slide is exactly the width of the track, so the offset is a
      // multiplication — no offsetLeft arithmetic that depends on which
      // ancestor happens to be the offsetParent.
      track.scrollTo({
        left: track.clientWidth * current,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    };

    const pause = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (stopped || timer !== null) return;
      timer = setInterval(() => goTo(current + 1), AUTOPLAY_MS);
    };

    // Deliberate interaction ends autoplay for this page view. Pausing would
    // not be enough: a slide must never be yanked away from someone who
    // chose it and is reading it.
    const stop = () => {
      stopped = true;
      pause();
    };

    // Observing the result rather than the cause: whatever moved the track —
    // autoplay, a swipe, the keyboard, the scrollbar — the dashes follow.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = slides.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;

          current = index;
          for (const [position, dot] of dots.entries()) {
            if (position === index) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    for (const slide of slides) observer.observe(slide);

    for (const [index, dot] of dots.entries()) {
      dot.addEventListener('click', () => {
        stop();
        goTo(index);
      });
    }

    track.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      stop();
      goTo(current + (event.key === 'ArrowRight' ? 1 : -1));
    });

    // Touch, wheel and drag are the honest signals that the visitor is
    // driving. A plain 'scroll' listener cannot be used here — it fires for
    // this script's own scrollTo() as well, which would stop autoplay one
    // tick after it started.
    for (const eventName of ['pointerdown', 'touchstart', 'wheel'] as const) {
      track.addEventListener(eventName, stop, { passive: true });
    }

    root.addEventListener('pointerenter', pause);
    root.addEventListener('pointerleave', start);
    root.addEventListener('focusin', pause);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else start();
    });

    start();
  }
</script>
```

- [ ] **Step 4: Run the slider e2e tests**

Run: `npx playwright test tests/e2e/slider.spec.ts`
Expected: PASS, 14 results (7 tests × 2 projects).

If `the arrow keys move through the slides` fails on the mobile project, check that `track.focus()` actually lands — the container needs the `tabindex="0"` added in Task 2.

- [ ] **Step 5: Re-run the accessibility suite**

Run: `npx playwright test tests/e2e/accessibility.spec.ts`
Expected: PASS, zero violations on `/`.

- [ ] **Step 6: Run the full verification set**

Run: `npm run build && npm test && npm run test:e2e`
Expected: all three exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/HeroSlider.astro tests/e2e/slider.spec.ts
git commit -m "feat: autoplay and dash controls for the hero slider"
```

---

### Task 4: Document how to edit slides

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the README's existing content section**

Run: `cat README.md`

Find the section that describes editing content in `src/data/`. Match its heading level and tone.

- [ ] **Step 2: Add the slides entry**

Add this to that section, adapting the heading level to match its neighbours:

```markdown
### Homepage slider

`src/data/slides.yaml` drives the full-width slider at the top of the homepage.
Each entry needs `id`, `image`, `imageAlt` and `title`; `eyebrow`, `href`, `cta`
and `order` are optional. `cta` only works together with `href`.

Slides run in `order` ascending, and any slide without an `order` falls after
those that have one. Put photography in `public/images/slides/` — the build
fails if `image` points at a file that is not there, so a typo cannot ship.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe how to edit homepage slides"
```

---

## Verification Checklist

Run after Task 4, before considering the feature done:

- [ ] `npm run build` — exit 0
- [ ] `npm test` — all vitest files pass, including the two new build-negative cases
- [ ] `npm run test:e2e` — all Playwright projects pass, `/` axe-clean
- [ ] `git status` — no stray modifications to `src/data/slides.yaml` left by build-negative tests
- [ ] `grep -rn "HeroPanel\|selectHero" src tests` — no output
