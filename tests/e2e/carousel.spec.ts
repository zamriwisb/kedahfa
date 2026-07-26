import { expect, test } from '@playwright/test';

const FIXTURES = '.card-carousel[data-carousel="fixtures"]';

test('the fixtures carousel exposes previous and next controls', async ({ page }) => {
  await page.goto('/');

  // 4 cards at 320px overflow the 1112px shell on desktop and the ~353px
  // Pixel 5 shell alike, so the controls show on both projects.
  await expect(page.getByRole('button', { name: 'Next fixtures' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeVisible();
});

test('next scrolls the fixtures track and previous brings it back', async ({ page }) => {
  await page.goto('/');

  const track = page.locator(`${FIXTURES} .card-carousel__track`);
  await expect(track).toHaveJSProperty('scrollLeft', 0);
  // The static default asserted by isolation from the dynamic case below:
  // proves the disabled state at rest before anything has moved the track.
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeDisabled();

  await page.getByRole('button', { name: 'Next fixtures' }).click();
  // scrollLeft is the observable effect of paging; poll because the scroll is
  // smooth, so it is not final on the click's next tick.
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });

  // Previous becomes usable the moment the track leaves its start.
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeEnabled();

  await page.getByRole('button', { name: 'Previous fixtures' }).click();
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
  }).toPass({ timeout: 5000 });

  // Round-trip: back at the start, previous must be disabled again — this is
  // the dynamic atStart/IntersectionObserver state, not the server-rendered
  // markup, so the assertion actually exercises the logic it names.
  await expect(page.getByRole('button', { name: 'Previous fixtures' })).toBeDisabled();
});

test('controls track a resize round-trip instead of sticking', async ({ page }) => {
  await page.goto('/');

  // Measured directly rather than assumed: the fixtures track overflows at
  // every width from 320px to 2400px+ (4 cards at up to 320px each vs. a
  // 1112px-max page-shell), so `controls.hidden` never flips here — that
  // part of the resize round-trip has to be covered where it CAN flip (the
  // squad carousel, per the code comment above the ResizeObserver). What
  // genuinely does flip on a resize, on this carousel, is `prev`'s disabled
  // state: below the sm breakpoint cards render at w-72 (288px), which is
  // wider than the ~280px track box at a 320px viewport, so the first card
  // no longer clears the observer's 0.99 intersection threshold and
  // `atStart` — hence `prev.disabled` — flips. That flip is driven by the
  // IntersectionObserver noticing the geometry change, exercised here via a
  // real resize rather than a click, so a regression that leaves it stale
  // after a resize (the general "sticking" failure mode Finding 1 is an
  // instance of) would show up as `prev` staying in its previous state below.
  const controls = page.locator(`${FIXTURES} .card-carousel__controls`);
  const prevButton = page.getByRole('button', { name: 'Previous fixtures' });

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeDisabled();

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeEnabled();

  // Round-trip back: the state must return with it, not stay stranded from
  // the narrow step.
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeDisabled();
});

test('the scroll region is reachable by keyboard', async ({ page }) => {
  await page.goto('/');

  // WCAG 2.1.1: a region a mouse can pan must be focusable too.
  await expect(page.locator(`${FIXTURES} .card-carousel__track`)).toHaveAttribute('tabindex', '0');
});
