import { expect, test } from '@playwright/test';

// Pages whose main content column must line up with the header — the crest is
// the leftmost thing on the page, so it is the reference edge readers notice.
const ROUTES = [
  '/',
  '/news',
  '/squad',
  '/fixtures',
  '/standings',
  '/club',
  '/contact',
  '/privacy',
  '/terms',
];

test.describe('the content column aligns with the header', () => {
  for (const route of ROUTES) {
    test(`${route} shares the header's left edge`, async ({ page }) => {
      await page.goto(route);

      const header = await page.locator('header .page-shell').first().boundingBox();
      const content = await page.locator('main .page-shell').first().boundingBox();

      expect(header).not.toBeNull();
      expect(content).not.toBeNull();
      expect(content!.x).toBeCloseTo(header!.x, 0);
      expect(content!.width).toBeCloseTo(header!.width, 0);
    });
  }
});

test('the fixture cards do not widen the document on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'layout-viewport check is mobile-only');
  await page.goto('/');
  // An absolutely-positioned descendant whose containing block escapes the
  // carousel's overflow clip would widen the document and make Chrome
  // shrink-to-fit the whole page — see MatchActions' `relative`.
  const { inner, client } = await page.evaluate(() => ({
    inner: window.innerWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(inner).toBe(client);
});
