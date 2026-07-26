import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Forces the timezone bug this project is most likely to ship.
    // Cloudflare builds in UTC; if the date helpers are correct only on a
    // machine set to Kuala Lumpur time, these tests must fail.
    env: { TZ: 'UTC' },
  },
});
