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
  const STACKS = [
    { token: '--font-body', fallback: 'Inter Fallback' },
    { token: '--font-display', fallback: 'Barlow Condensed Fallback' },
  ];

  for (const { token, fallback } of STACKS) {
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

    test(`"${fallback}" is registered with metric overrides`, async ({ page }) => {
      await page.goto('/');

      const overrides = await page.evaluate((family) => {
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRuleList;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const rule of Array.from(rules)) {
            if (!(rule instanceof CSSFontFaceRule)) continue;
            const style = rule.style as CSSStyleDeclaration & Record<string, string>;
            if (!style.getPropertyValue('font-family').includes(family)) continue;
            return {
              sizeAdjust: style.getPropertyValue('size-adjust'),
              ascent: style.getPropertyValue('ascent-override'),
              descent: style.getPropertyValue('descent-override'),
            };
          }
        }
        return null;
      }, fallback);

      expect(overrides, `no @font-face for ${fallback}`).not.toBeNull();
      expect(overrides!.sizeAdjust).toMatch(/%$/);
      expect(overrides!.ascent).toMatch(/%$/);
      expect(overrides!.descent).toMatch(/%$/);
    });
  }
});
