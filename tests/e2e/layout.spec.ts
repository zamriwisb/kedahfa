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
