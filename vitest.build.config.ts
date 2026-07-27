import { defineConfig } from 'vitest/config';

/**
 * The slow half of the suite: tests that spawn a real `npm run build` and
 * assert it fails on bad content. Split out of vitest.config.ts so `npm test`
 * stays fast enough to run on every edit; this config runs under
 * `npm run test:build`, and CI runs it as its own step.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/build/**/*.test.ts'],
    // Cloudflare and CI build in UTC. The offset-less-date and US-date-slash
    // cases only fail under UTC, so this must match vitest.config.ts.
    env: { TZ: 'UTC' },
    // Every test here mutates a real file in src/ and restores it afterwards.
    // Two such files running concurrently would see each other's mutations,
    // so they must not run in parallel — this matters as soon as a second
    // file lands in tests/build/.
    fileParallelism: false,
  },
});
