import type { FullConfig } from '@playwright/test';

/**
 * Refuses to run the suite against a dev server.
 *
 * The suite is written against the static build: specs assert things like
 * "this page has exactly one h1". A dev server breaks those assertions in a
 * way that looks like a site bug rather than a wiring mistake, because the
 * Astro dev toolbar mounts its own markup in OPEN shadow roots and
 * Playwright's CSS engine pierces open shadow roots by default. The toolbar's
 * Audit and Settings windows contribute four h1s of their own, so
 * `page.locator('h1')` reports 5 while `document.querySelectorAll('h1')`
 * reports 1 — and it reports 5 only once the toolbar has hydrated, so which
 * pages fail varies from run to run.
 *
 * `reuseExistingServer` is what lets a foreign server in: it attaches to
 * whatever already listens on the port instead of starting `astro preview`.
 * The e2e port is deliberately not the dev server's (see playwright.config.ts),
 * which removes the collision this project used to hit every time — CLAUDE.md
 * tells everyone to leave `astro dev --background` running. This check is the
 * backstop for the cases a distinct port cannot cover: `astro dev --port`
 * aimed here, or any other process squatting on it.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  const response = await fetch(baseURL);
  const html = await response.text();

  // Both markers are dev-only: Vite's HMR client is injected by `astro dev`
  // and never by `astro build`, and the toolbar element is the thing that
  // actually corrupts the assertions.
  const marker = ['@vite/client', 'astro-dev-toolbar'].find((needle) => html.includes(needle));

  if (marker) {
    throw new Error(
      `The server at ${baseURL} is an Astro dev server (found "${marker}" in the HTML), ` +
        `but this suite tests the static build.\n\n` +
        `The dev toolbar's shadow DOM adds headings and landmarks that Playwright ` +
        `selectors pierce, so specs fail with counts that look like site bugs.\n\n` +
        `Stop whatever is on that port (e.g. \`astro dev stop\`) and re-run: ` +
        `Playwright will start \`astro preview\` itself.`,
    );
  }
}
