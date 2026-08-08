import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/news',
  '/squad',
  '/squad/rajendran',
  '/fixtures',
  '/standings',
  '/club',
  '/contact',
  '/privacy',
  '/terms',
  '/404',
];

for (const route of ROUTES) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test('every image has an alt attribute', async ({ page }) => {
  await page.goto('/news');

  for (const image of await page.locator('img').all()) {
    // Decorative images use alt="" with aria-hidden; both are acceptable.
    expect(await image.getAttribute('alt')).not.toBeNull();
  }
});

test('the skip link is reachable by keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
