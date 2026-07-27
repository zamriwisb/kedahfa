import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/news', '/squad', '/fixtures', '/standings', '/club', '/contact'];

test.describe('every route renders', () => {
  for (const route of ROUTES) {
    test(`${route} responds with 200 and a single h1`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }
});

test('the header links reach their pages', async ({ page, isMobile }) => {
  await page.goto('/');

  if (isMobile) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }

  // Scoped to the header: the footer's Sport column links /squad under the same
  // name, so a page-wide query matches two links and fails strict mode. Only
  // the header's copy is under test here. getByRole skips the display:none
  // desktop nav on mobile, so this resolves to one link on both projects.
  await page.locator('header').getByRole('link', { name: 'Squad', exact: true }).click();
  await expect(page).toHaveURL(/\/squad$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Squad');
});

test('the mobile menu opens, closes on Escape and returns focus', async ({ page, isMobile }) => {
  // The callback form of test.skip() is only valid at file/describe scope;
  // inside a running test, skipping conditionally takes a boolean.
  test.skip(!isMobile, 'mobile-only behaviour');

  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Menu' });

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('an unknown URL serves the 404 page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
