import { expect, test } from '@playwright/test';

test('the homepage opens with the slider', async ({ page }) => {
  await page.goto('/');

  const slider = page.locator('.hero-slider');
  await expect(slider).toBeVisible();
  await expect(slider.locator('.hero-slider__slide')).toHaveCount(3);
});

// Deliberately asserts the SHAPE of the first slide, not its copy. The
// previous version named a "Season tickets are on sale now" headline and a
// "Buy Tickets" button from the seed data; when real slides replaced that
// seed the test failed for months while nothing was actually broken. Slide
// copy is curated content that changes whenever the club has something new
// to say, so pinning it here buys nothing and costs a red suite.
test('the first slide shows a headline that links to its story', async ({ page }) => {
  await page.goto('/');

  const heading = page.locator('.hero-slider__slide').first().getByRole('heading', { level: 2 });
  await expect(heading).toBeVisible();
  await expect(heading).not.toBeEmpty();

  // Every slide in slides.yaml carries an href today, and HeroSlider wraps
  // the headline in it. A slide without one renders bare text instead, which
  // is legal — hence checking the link only when it is there.
  const link = heading.getByRole('link');
  if ((await link.count()) > 0) {
    await expect(link).toHaveAttribute('href', /\S/);
  }
});

test('every slide names its own position in the set', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.hero-slider__slide').first()).toHaveAttribute('aria-label', '1 of 3');
  await expect(page.locator('.hero-slider__slide').last()).toHaveAttribute('aria-label', '3 of 3');
});

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

  // Move the pointer off the slider so pointerleave fires: an implementation
  // that merely paused instead of stopping would restart its timer here, and
  // the assertion below would fail.
  await page.mouse.move(0, 0);

  // A slide must never be yanked away from someone reading it: well past one
  // autoplay interval, slide 2 is still the active one.
  await page.waitForTimeout(9000);
  await expect(page.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('the pause control is visible and named for what it does', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Pause slideshow' })).toBeVisible();
});

test('pressing the pause control stops autoplay', async ({ page }) => {
  await page.goto('/');

  // Pin the starting slide: on a slow runner a >6s gap before the click would
  // otherwise let autoplay reach slide 2 and fail the assertion below for a
  // reason that has nothing to do with the pause control.
  await expect(page.getByRole('button', { name: 'Go to slide 1' })).toHaveAttribute(
    'aria-current',
    'true',
  );

  await page.getByRole('button', { name: 'Pause slideshow' }).click();
  await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible();

  // Move the pointer away so the transient hover-pause is not what's being
  // measured — the button's durable stopped state must hold on its own.
  await page.mouse.move(0, 0);

  await page.waitForTimeout(9000);
  await expect(page.getByRole('button', { name: 'Go to slide 1' })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('taking control another way flips the pause control too', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Go to slide 2' }).click();

  await expect(page.getByRole('button', { name: 'Play slideshow' })).toBeVisible();
});

test('the desktop split keeps the photo near its source ratio at every width', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the split starts at xl');

  // The regression this exists for: the slide used to hold a fixed 620px
  // height whatever the viewport did, so a 16:9 source met a 2.06:1 box at
  // 1280 and a 3.10:1 box at 1920 — object-cover answered by discarding 43% of
  // the image's height, and the wider the monitor the worse it got. Column 3
  // now absorbs the extra width while the height grows with it.
  const SOURCE = 1920 / 1080;

  for (const width of [1280, 1600, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const ratio = await page.evaluate(() => {
      const media = document.querySelector('.hero-slider__slide > div')!.getBoundingClientRect();
      return media.width / media.height;
    });

    // Anything inside ±20% of the source is a crop nobody reads as damage.
    expect(Math.abs(1 - ratio / SOURCE), `photo box ratio at ${width}px was ${ratio}`).toBeLessThan(
      0.2,
    );
  }
});

test('the hero copy keeps the page left edge the crest sits on', async ({ page }) => {
  // The copy deliberately does NOT wear `page-shell` — at xl it lives in grid
  // column 2 with column 1 sized to the shell's own inset. That means the
  // shared-edge sweep in layout.spec.ts no longer covers the hero, so the
  // alignment it used to guarantee is asserted here instead, on both projects.
  await page.goto('/');

  const { copyLeft, headerLeft } = await page.evaluate(() => {
    const copy = document.querySelector('.hero-slider__slide h2')!.getBoundingClientRect();
    const shell = document.querySelector('header .page-shell')!;
    const box = shell.getBoundingClientRect();
    // The shell's own padding is part of the edge readers see.
    const padding = parseFloat(getComputedStyle(shell).paddingLeft);
    return { copyLeft: copy.left, headerLeft: box.left + padding };
  });

  expect(copyLeft).toBeCloseTo(headerLeft, 0);
});

test('a slide can anchor its crop away from centre', async ({ page }) => {
  // Not every slide image is a centred portrait cut to 16:9. The signing
  // slide is an announcement graphic composed wide — crest and wordmark on
  // the left, the player himself around 72% across — and the hero box is
  // TALLER than it is wide on a phone. object-cover answers by showing only
  // the middle ~52% of the source, which slices the player at the frame edge
  // and drops the crest and squad number entirely. `objectPosition` in
  // slides.yaml is what lets that one slide anchor the cut on its subject
  // instead, without moving the other two off centre.
  await page.goto('/');

  const positions = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-slider__slide img')].map(
      (img) => getComputedStyle(img).objectPosition,
    ),
  );

  // Slide 2 anchors right; the slides that declare nothing stay centred, so
  // the field cannot silently become a global default.
  expect(positions[1]).toBe('100% 50%');
  expect(positions[0]).toBe('50% 50%');
});
