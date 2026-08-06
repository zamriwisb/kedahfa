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

test('club crests line up across neighbouring fixture cards', async ({ page }) => {
  await page.goto('/fixtures');

  // The grid is single-column below the `sm` breakpoint, where every card is
  // its own row and a same-row comparison would not hold.
  test.skip(page.viewportSize()!.width < 640, 'grid is single-column below sm');

  // The Upcoming section groups fixtures by month, so each `grid gap-4
  // sm:grid-cols-2` container is its OWN two-column grid — the first card of
  // one month's group and the first card of the next month's are not
  // necessarily on the same row. Pick a month group with at least 4 fixtures
  // so cards 0/1 and 2/3 are guaranteed to share a row within it, rather than
  // hardcoding a month name that next season's data would invalidate.
  const grids = page.locator('div.grid.gap-4');
  const gridCount = await grids.count();
  let target = null;
  for (let i = 0; i < gridCount; i++) {
    if ((await grids.nth(i).locator('[data-competition]').count()) >= 4) {
      target = grids.nth(i);
      break;
    }
  }
  expect(target, 'expected some month group with at least 4 upcoming fixtures').not.toBeNull();

  // Compare one crest per CARD, not `img` across the whole grid — every card
  // renders two crests (home and away), so comparing image 0 against image 1
  // would just compare a card against itself and pass trivially.
  const cards = target!.locator('[data-competition]');
  const firstCrestOf = (i: number) => cards.nth(i).locator('img').first();

  const tops: number[] = [];
  for (let i = 0; i < 4; i++) {
    const box = await firstCrestOf(i).boundingBox();
    expect(box).not.toBeNull();
    tops.push(box!.y);
  }

  // Cards in the same grid row must place their crests at the same y. Cards
  // in the next row down are offset by the row height, so compare only the
  // distinct values within a row: the first two cards share row one, the
  // next two share row two.
  expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
  expect(Math.abs(tops[2] - tops[3])).toBeLessThan(1);
});

test('a card with ticket actions keeps its crests level with one without', async ({ page }) => {
  await page.goto('/');

  const cards = page.locator('.card-carousel__track [data-competition]');
  const withActions = cards.filter({ has: page.locator('[data-match-actions]') }).first();
  const withoutActions = cards.filter({ hasNot: page.locator('[data-match-actions]') }).first();

  const a = await withActions.locator('img').first().boundingBox();
  const b = await withoutActions.locator('img').first().boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();

  // This is the regression the action bar introduced: the taller card's
  // crest floated up because the crest row was centred in the slack.
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
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
