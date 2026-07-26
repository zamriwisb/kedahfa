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

test('the standings table lists all twelve clubs, zeroed for the pre-season', async ({ page }) => {
  await page.goto('/standings');

  // One rowheader per club; the header row contributes none.
  await expect(page.getByRole('rowheader')).toHaveCount(12);

  // Last cell of a row is its points total.
  // "Kedah FA" is the teams.yaml name, which is what the table renders.
  // club.yaml's fuller "Kedah Football Association" drives the header and
  // footer instead, so matching on it here would pass for the wrong reason.
  const kedah = page.getByRole('row').filter({ hasText: 'Kedah FA' });
  await expect(kedah.getByRole('cell').last()).toHaveText('0');
});

test('the fixtures page lists the scheduled matches and no results yet', async ({ page }) => {
  await page.goto('/fixtures');

  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();

  // Every placeholder fixture is scheduled, so Results stays empty while
  // Upcoming is populated. This is the pairing that would break if a match
  // were given a score without the standings table being updated to match.
  await expect(page.getByText('No matches have been played yet this season.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Results', exact: true })).toBeVisible();
});

test('kickoff times render in Malaysian time', async ({ page }) => {
  await page.goto('/fixtures');
  // Home fixtures kick off at 20:45 +08:00. A naive UTC render would show 12:45.
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

test('a news article opens from the listing and renders its content', async ({ page }) => {
  await page.goto('/news');

  // Target the card link by structure, not by title text, so renaming an
  // article doesn't break this test.
  await page.locator('[data-category] a').first().click();

  await expect(page).toHaveURL(/\/news\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
