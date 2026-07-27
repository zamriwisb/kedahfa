import { expect, test } from '@playwright/test';

test('every social link carries an accessible name', async ({ page }) => {
  await page.goto('/');

  const links = page.locator('footer a[rel~="me"]');
  await expect(links).not.toHaveCount(0);

  for (const link of await links.all()) {
    // The mark itself is aria-hidden, so the anchor's own label is the only
    // name a screen reader can announce. An unlabelled icon link reads as its
    // href.
    const label = await link.getAttribute('aria-label');
    expect(label?.trim()).toBeTruthy();
  }
});

test('the social marks render Font Awesome geometry, not a 24-grid fallback', async ({ page }) => {
  await page.goto('/');

  // Font Awesome brand packs are 512 tall and filled; the hand-drawn paths this
  // replaced were stroked on a 0 0 24 24 box. Asserting on the viewBox catches
  // a regression to the old inline set, which would still look roughly right.
  const first = page.locator('footer a[rel~="me"] svg').first();
  await expect(first).toHaveAttribute('viewBox', /^0 0 \d+ 512$/);
  await expect(first).toHaveAttribute('fill', 'currentColor');
});

test('the footer link columns reach the pages they name', async ({ page }) => {
  await page.goto('/');

  const footerNav = page.getByRole('navigation', { name: 'Footer' });
  await expect(footerNav.getByRole('link', { name: 'Match Fixtures' })).toHaveAttribute(
    'href',
    '/fixtures',
  );

  await footerNav.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Footer' }).getByRole('link', {
    name: 'Terms & Conditions',
  }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeVisible();
});

test('the partner band renders sitewide, including on 404', async ({ page }) => {
  // Moving the sponsor grid into the footer is what puts it on every route;
  // the two page-level sponsor sections were removed in the same change, so a
  // regression that restored them would show partners twice on the homepage.
  await page.goto('/404');
  await expect(page.getByRole('heading', { name: 'Our partners' })).toBeAttached();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Our partners' })).toHaveCount(1);
});
