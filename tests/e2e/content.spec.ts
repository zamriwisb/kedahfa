import { expect, test } from '@playwright/test';

test('the homepage fixtures strip shows the pre-season empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No fixtures are currently scheduled.')).toBeVisible();
});

test('the standings table highlights the club row', async ({ page }) => {
  await page.goto('/standings');
  await expect(page.getByRole('rowheader', { name: /Kedah/ })).toBeVisible();
});

test('the standings table lists all twelve clubs, zeroed for the pre-season', async ({ page }) => {
  await page.goto('/standings');

  // One rowheader per club; the header row contributes none.
  await expect(page.getByRole('rowheader')).toHaveCount(12);

  // Last cell of a row is its points total.
  const kedah = page.getByRole('row').filter({ hasText: 'Kedah Football Association' });
  await expect(kedah.getByRole('cell').last()).toHaveText('0');
});

test('the fixtures page shows the empty state until the schedule is published', async ({ page }) => {
  await page.goto('/fixtures');
  await expect(page.getByText('No fixtures are currently scheduled.')).toBeVisible();
});

test('the news filter narrows the visible articles', async ({ page }) => {
  await page.goto('/news');

  const before = await page.locator('[data-category]:visible').count();
  await page.getByRole('button', { name: 'Transfers' }).click();
  const after = await page.locator('[data-category]:visible').count();

  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

test('a player profile shows the squad number and details', async ({ page }) => {
  await page.goto('/squad');
  await page.getByRole('link', { name: /Firdaus Rahman/ }).click();

  await expect(page.getByRole('heading', { name: 'Firdaus Rahman' })).toBeVisible();
  await expect(page.getByText('Squad number')).toBeVisible();
});

test('the RSS feed is served and lists articles', async ({ request }) => {
  const response = await request.get('/rss.xml');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('<item>');
});
