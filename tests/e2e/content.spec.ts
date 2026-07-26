import { expect, test } from '@playwright/test';

test('the homepage shows a countdown that advances', async ({ page }) => {
  await page.goto('/');

  const seconds = page.locator('.countdown [data-unit="seconds"]').first();
  const first = await seconds.textContent();

  await expect(async () => {
    expect(await seconds.textContent()).not.toBe(first);
  }).toPass({ timeout: 5000 });
});

test('the standings table highlights the club row', async ({ page }) => {
  await page.goto('/standings');
  await expect(page.getByRole('rowheader', { name: /Kedah/ })).toBeVisible();
});

test('standings points are derived, not stored', async ({ page }) => {
  await page.goto('/standings');

  // JDT: 9 wins, 2 draws => 29 points, 11 played.
  const row = page.getByRole('row').filter({ hasText: "Johor Darul Ta'zim" });
  await expect(row.getByRole('cell').last()).toHaveText('29');
});

test('the fixtures page separates upcoming, postponed and results', async ({ page }) => {
  await page.goto('/fixtures');

  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postponed' })).toBeVisible();
  // exact: true — "Results" is otherwise a substring match of the page's own
  // "Fixtures & Results" heading, which makes the locator ambiguous.
  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible();
});

test('kickoff times render in Malaysian time', async ({ page }) => {
  await page.goto('/fixtures');
  // The JDT home fixture kicks off at 20:45 +08:00.
  await expect(page.getByText('20:45').first()).toBeVisible();
});

test('the news filter narrows the visible articles', async ({ page }) => {
  await page.goto('/news');

  const before = await page.locator('[data-category]:visible').count();
  await page.getByRole('button', { name: 'Transfers' }).click();
  const after = await page.locator('[data-category]:visible').count();

  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

test('a match report links from the fixture row to the article', async ({ page }) => {
  await page.goto('/fixtures');
  await page.getByRole('link', { name: 'Report' }).first().click();
  await expect(page).toHaveURL(/\/news\//);
  await expect(page.locator('h1')).toBeVisible();
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
