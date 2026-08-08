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

test('the mobile header carries one bar and no duplicate destinations', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile-only layout');

  await page.goto('/');
  const header = page.locator('header');

  // The Contact CTA and the header socials are desktop-only now: Contact is
  // already the last row of the menu panel, and the same socials sit in the
  // footer. Both were competing with the only control that navigates.
  await expect(header.getByRole('link', { name: 'Contact' })).toBeHidden();
  await expect(header.locator('a[rel~="me"]').first()).toBeHidden();

  // One home link, not a crest link stacked on a wordmark link.
  await expect(header.getByRole('link', { name: /home$/ })).toHaveCount(1);

  // The second tier is gone below `md`, so the header is a single bar. The
  // exact height is not the contract — staying well under the old two-tier
  // 128px is.
  const box = await header.boundingBox();
  expect(box!.height).toBeLessThan(80);
});

test('the mobile menu panel opens flush against the header, full width', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile-only behaviour');

  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();

  // The panel is positioned `top-full` against the header's inner shell rather
  // than the header itself. Those coincide only while the second tier is
  // display:none; if it ever renders on mobile again the panel opens over it,
  // and nothing else would catch that.
  const { headerBottom, panelTop, panelLeft, panelWidth, viewport } = await page.evaluate(() => {
    const header = document.querySelector('header')!.getBoundingClientRect();
    const panel = document.querySelector('#mobile-nav')!.getBoundingClientRect();
    return {
      headerBottom: header.bottom,
      panelTop: panel.top,
      panelLeft: panel.left,
      panelWidth: panel.width,
      viewport: window.innerWidth,
    };
  });

  expect(Math.abs(panelTop - headerBottom)).toBeLessThan(1);
  expect(panelLeft).toBeCloseTo(0, 0);
  expect(panelWidth).toBeCloseTo(viewport, 0);
});

test('the menu panel marks the page you are on', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the panel is the only navigation below md');

  await page.goto('/squad');
  await page.getByRole('button', { name: 'Menu' }).click();

  const panel = page.locator('#mobile-nav');
  await expect(panel.getByRole('link', { name: 'Squad' })).toHaveAttribute('aria-current', 'page');

  // State on two channels, not colour alone: the accent text plus a filled
  // row. Assert the fill, since a colour-only mark is the failure mode.
  const filled = await panel
    .getByRole('link', { name: 'Squad' })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  const plain = await panel
    .getByRole('link', { name: 'News' })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(filled).not.toBe(plain);

  await expect(panel.getByRole('link', { name: 'News' })).not.toHaveAttribute('aria-current', /.*/);
});

test('an unknown URL serves the 404 page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
