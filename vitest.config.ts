import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Forces the timezone bug this project is most likely to ship.
    // Cloudflare builds in UTC; if the date helpers are correct only on a
    // machine set to Kuala Lumpur time, these tests must fail.
    env: { TZ: 'UTC' },
    // fileParallelism is left at its default (parallel) deliberately. It was
    // previously disabled because build-negative.test.ts mutates real
    // src/data/*.yaml files while league-data.test.ts reads those same files
    // off disk, which races across workers. That file now lives in tests/build/
    // and runs under vitest.build.config.ts, so nothing this config picks up
    // writes into src/ — validate.test.ts, the only other test that writes,
    // does so inside mkdtempSync(tmpdir()).
    //
    // If you add a test here that mutates a file inside src/, move it to
    // tests/build/ instead of turning fileParallelism off again.
  },
});
