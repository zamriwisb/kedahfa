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
