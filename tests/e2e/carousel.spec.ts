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
