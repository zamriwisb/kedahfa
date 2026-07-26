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
