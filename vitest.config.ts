import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Forces the timezone bug this project is most likely to ship.
    // Cloudflare builds in UTC; if the date helpers are correct only on a
    // machine set to Kuala Lumpur time, these tests must fail.
    env: { TZ: 'UTC' },
    // build-negative.test.ts writes real mutated content to src/data/*.yaml
    // for the duration of each case before restoring it. league-data.test.ts
    // reads those same files straight off disk, so running test files in
    // parallel makes it flaky: it can observe the mutated content of
    // whichever case happens to be mid-flight in another worker. Files still
    // run in a single worker, sequentially, which costs nothing here since
    // build-negative's real `astro build` calls already dominate total time.
    fileParallelism: false,
  },
});
