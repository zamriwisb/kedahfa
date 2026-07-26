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
  // squad carousel, per the code comment above the ResizeObserver).
  //
  // `prev`'s disabled state is what this test guards, and it is a regression
  // test for a real defect: below the sm breakpoint cards render at w-72
  // (288px), which is wider than the ~280px track box at a 320px viewport —
  // exactly the width WCAG 1.4.10 Reflow specifies. atStart/atEnd used to
  // come from an IntersectionObserver at threshold: 0.99, and a card wider
  // than its track can never reach 99% visibility, so the first card never
  // registered as intersecting and `prev` stayed wrongly ENABLED-but-inert at
  // 320px. Edge state is now derived from scroll geometry (`track.scrollLeft`)
  // instead, which has no such blind spot: the track is at rest (scrollLeft 0)
  // at every width in this round-trip, so `prev` must stay disabled
  // throughout. Revert atStart to intersection-based detection and the
  // assertion at the 320px step below fails again.
  const controls = page.locator(`${FIXTURES} .card-carousel__controls`);
  const prevButton = page.getByRole('button', { name: 'Previous fixtures' });

  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeDisabled();

  await page.setViewportSize({ width: 320, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeDisabled();

  // Round-trip back: the state must stay correct, not flip from the narrow
  // step.
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(controls).toBeVisible();
  await expect(prevButton).toBeDisabled();
});

test('the scroll region is reachable by keyboard', async ({ page }) => {
  await page.goto('/');

  // WCAG 2.1.1: a region a mouse can pan must be focusable too.
  await expect(page.locator(`${FIXTURES} .card-carousel__track`)).toHaveAttribute('tabindex', '0');
});

const SQUAD = '.card-carousel[data-carousel="squad"]';

test('the squad carousel advances on its own', async ({ page }, testInfo) => {
  // 6 cards at 160px fit the 1112px desktop shell, so there is nothing to
  // autoplay there. Pixel 5 is where the track actually overflows.
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);
  await expect(track).toHaveJSProperty('scrollLeft', 0);

  // Autoplay is 6s; allow one interval plus the smooth scroll.
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('hovering the squad carousel holds it still', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);

  // Hover without clicking: this must PAUSE, not stop.
  await track.hover();
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

  // Moving off must resume. Without this half the test cannot tell a pause
  // from a stop — slider.spec.ts records the same lesson.
  await page.mouse.move(0, 0);
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('tabbing out of a card while the pointer still rests on the carousel does not resume it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);

  // Hover first (pauses), then focus a card link inside it (still paused) —
  // this is the state a keyboard user tabbing through the page while the
  // mouse happens to rest on the strip ends up in.
  await track.hover();
  const firstLink = track.locator('a').first();
  await firstLink.focus();

  // Tab back OUT: focus leaves the carousel entirely, firing focusout while
  // the cursor is still over the track. Four independent bare pause()/start()
  // calls used to let focusout's start() win outright here, resuming the
  // track under a resting cursor — breaking "pause on hover". The resolver
  // must still see `hovered` and hold still.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

  // Sanity: moving the pointer away (the only remaining reason to hold
  // still) resumes it, proving this was a pause and not a stop.
  await page.mouse.move(0, 0);
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('moving the pointer away while focus stays inside the carousel does not resume it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');
  const track = page.locator(`${SQUAD} .card-carousel__track`);

  await track.hover();
  const firstLink = track.locator('a').first();
  await firstLink.focus();

  // Move the pointer away while focus is still on the first player link.
  // pointerleave's bare start() used to win here regardless of focus,
  // scrolling the focused link off-screen while it still held focus (WCAG
  // 2.4.11 Focus Not Obscured).
  await page.mouse.move(0, 0);

  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(firstLink).toBeFocused();

  // Sanity: blurring (the only remaining reason to hold still) resumes it,
  // proving this was a pause tied to focus, not a stop.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });
});

test('the squad carousel offers a pause control that stops it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.goto('/');

  // WCAG 2.2.2: auto-moving content needs a discoverable way to stop it.
  const pauseButton = page.getByRole('button', { name: 'Pause players carousel' });
  await expect(pauseButton).toBeVisible();

  await pauseButton.click();
  await expect(page.getByRole('button', { name: 'Play players carousel' })).toBeVisible();

  // Off the control, so the durable stopped state is what is measured rather
  // than the transient hover-pause.
  await page.mouse.move(0, 0);
  const track = page.locator(`${SQUAD} .card-carousel__track`);
  const resting = await track.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(resting);
});

test('a carousel whose cards already fit shows no controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the squad track only fits on desktop');

  await page.goto('/');

  // 6 × 160px + 5 × 16px = 1040px inside 1112px of shell: nothing to page
  // through, so the controls must stay hidden rather than move nothing.
  await expect(page.locator(`${SQUAD} .card-carousel__controls`)).toBeHidden();
  // The fixtures track on the same page does overflow, which proves the
  // hidden state above is a real measurement and not a broken selector.
  await expect(page.locator(`${FIXTURES} .card-carousel__controls`)).toBeVisible();
});

test('reduced motion suppresses autoplay and its pause control', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'squad track only overflows on mobile');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const track = page.locator(`${SQUAD} .card-carousel__track`);
  await page.waitForTimeout(9000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);

  // The toggle is only unhidden when the timer starts, so it must not appear.
  await expect(page.locator(`${SQUAD} .card-carousel__toggle`)).toBeHidden();
});

test('autoplay resumes after a resize round-trip back to an overflowing track', async ({ page }) => {
  // This is desktop-only on purpose. The squad track fits at desktop width
  // (1112px shell, 1040px of cards) and overflows on a narrow one — exactly
  // the pair of states syncControls' start()/pause() symmetry has to survive.
  // Starting narrow, widening past the fit point, then narrowing back is the
  // only round-trip that can observe the resume half of that fix: it was
  // proven un-testable on the fixtures carousel (which always overflows, so
  // syncControls never has a reason to call pause() there) and the fixtures
  // resize test above says as much.
  await page.goto('/');
  await page.setViewportSize({ width: 353, height: 800 });

  const track = page.locator(`${SQUAD} .card-carousel__track`);
  const controls = page.locator(`${SQUAD} .card-carousel__controls`);

  await expect(controls).toBeVisible();
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }).toPass({ timeout: 12_000 });

  // Widen past the fit point: the track no longer overflows, so autoplay
  // must pause and the controls must hide.
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(controls).toBeHidden();
  const restingLeft = await track.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(7000);
  expect(await track.evaluate((el) => el.scrollLeft)).toBe(restingLeft);

  // Narrow back: the track overflows again, and this is the assertion the
  // fix is for — autoplay must have resumed, not stay dead from the wide step.
  await page.setViewportSize({ width: 353, height: 800 });
  await expect(controls).toBeVisible();
  const afterResize = await track.evaluate((el) => el.scrollLeft);
  await expect(async () => {
    expect(await track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(afterResize);
  }).toPass({ timeout: 12_000 });
});
