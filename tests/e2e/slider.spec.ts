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
