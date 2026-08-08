/**
 * True only on the GitHub Pages staging deploy, which sets SITE_ENV=staging.
 *
 * Deliberately separate from SITE_URL. A hostname is not a claim about
 * indexing policy, and a future production Pages deploy will want to set the
 * URL without also asking to be de-indexed.
 *
 * A function rather than a const: a const would capture process.env once at
 * module load, so a test covering both branches would need vi.resetModules()
 * and a dynamic re-import per case.
 *
 * process.env rather than import.meta.env: this is imported only from
 * BaseLayout.astro's frontmatter, which for `output: 'static'` runs in Node at
 * build time and never reaches the browser.
 */
export function isStaging(): boolean {
  return process.env.SITE_ENV === 'staging';
}
