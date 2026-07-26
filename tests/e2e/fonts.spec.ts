import { expect, test } from '@playwright/test';

/*
 * Fonts are self-hosted via fontsource and their @font-face rules live inside
 * the built stylesheet, so the browser cannot discover the woff2 URLs until it
 * has downloaded and parsed that CSS. Preloading the two faces used above the
 * fold collapses that serialized round trip; the metric-matched fallback faces
 * stop `font-display: swap` from reflowing the page when the real fonts land.
 */

const PRELOADED = [
  { label: 'Inter body', pattern: /inter-latin-wght-normal.*\.woff2$/ },
  { label: 'Barlow Condensed 700 display', pattern: /barlow-condensed-latin-700-normal.*\.woff2$/ },
];

test.describe('above-the-fold fonts are preloaded', () => {
  for (const { label, pattern } of PRELOADED) {
    test(`${label} has a crossorigin woff2 preload that resolves`, async ({ page, request }) => {
      await page.goto('/');

      // Attribute selectors cannot take a regex, so collect every font preload
      // and match the hashed filename in JS.
      const hrefs = await page
        .locator('link[rel="preload"][as="font"]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href') ?? ''));
      const href = hrefs.find((h) => pattern.test(h));
      expect(href, `no preload matching ${pattern}`).toBeTruthy();

      const preload = page.locator(`link[rel="preload"][href="${href}"]`);
      await expect(preload).toHaveAttribute('as', 'font');
      await expect(preload).toHaveAttribute('type', 'font/woff2');
      // Fonts are always fetched in CORS mode; without crossorigin the browser
      // discards the preload and downloads the file a second time.
      await expect(preload).toHaveAttribute('crossorigin', /.*/);

      const response = await request.get(href!);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('metric-matched fallbacks absorb the swap', () => {
  // font-weight matters here: Barlow Condensed Fallback registers separate
  // @font-face overrides for 600 and 700, and .font-display/h1-h3 (global.css)
  // only ever render the display stack at 700 — a test at the wrong weight
  // would measure overrides nobody uses.
  const STACKS = [
    { token: '--font-body', fallback: 'Inter Fallback', weight: '400' },
    { token: '--font-display', fallback: 'Barlow Condensed Fallback', weight: '700' },
  ];

  for (const { token, fallback, weight } of STACKS) {
    test(`${token} lists "${fallback}" ahead of the generic stack`, async ({ page }) => {
      await page.goto('/');

      const stack = await page.evaluate(
        (name) => getComputedStyle(document.documentElement).getPropertyValue(name),
        token,
      );
      expect(stack).toContain(fallback);
      // The adjusted face must come before the unadjusted generics, or the
      // browser never reaches it.
      expect(stack.indexOf(fallback)).toBeLessThan(stack.indexOf('ui-sans-serif'));
    });

    test(`"${fallback}" renders text within 3% of the real font's width`, async ({ page }) => {
      await page.goto('/');

      // The describe block's claim is that the fallback absorbs the swap
      // without a reflow — the only way to prove that is to actually render
      // the same string in both faces and compare pixel widths. Asserting
      // that size-adjust/ascent-override/descent-override merely end in "%"
      // (the previous version of this test) would let `size-adjust: 1%`
      // through: it matches the pattern while being wildly wrong. This
      // measures the property the describe block names.
      const { realFamily, realWidth, fallbackWidth, diffPct } = await page.evaluate(
        async ({ token, fallback, weight }) => {
          const stack = getComputedStyle(document.documentElement).getPropertyValue(token);
          const realFamily = stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

          const fontString = (family: string) => `${weight} 64px "${family}"`;
          await Promise.all([
            document.fonts.load(fontString(realFamily)),
            document.fonts.load(fontString(fallback)),
          ]);

          const text = 'The quick brown fox jumps over the lazy dog 0123456789';
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          ctx.font = fontString(realFamily);
          const realWidth = ctx.measureText(text).width;

          ctx.font = fontString(fallback);
          const fallbackWidth = ctx.measureText(text).width;

          return {
            realFamily,
            realWidth,
            fallbackWidth,
            diffPct: (Math.abs(fallbackWidth - realWidth) / realWidth) * 100,
          };
        },
        { token, fallback, weight },
      );

      // Widths of 0 mean the family failed to resolve (e.g. a typo'd name)
      // and would make diffPct meaningless (0/0 or a false-positive small
      // ratio) rather than genuinely close.
      expect(realWidth, `"${realFamily}" measured zero width`).toBeGreaterThan(0);
      expect(fallbackWidth, `"${fallback}" measured zero width`).toBeGreaterThan(0);
      // Reviewer measured today's values at 0.18% (Inter Fallback) and 2.77%
      // (Barlow Condensed Fallback at weight 700) — both comfortably inside
      // this budget.
      expect(diffPct).toBeLessThan(3);
    });
  }
});
