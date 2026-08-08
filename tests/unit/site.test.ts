import { afterEach, describe, expect, it } from 'vitest';
import { isStaging } from '../../src/lib/site';

const original = process.env.SITE_ENV;

afterEach(() => {
  if (original === undefined) delete process.env.SITE_ENV;
  else process.env.SITE_ENV = original;
});

describe('isStaging', () => {
  it('is true for the exact staging marker', () => {
    process.env.SITE_ENV = 'staging';
    expect(isStaging()).toBe(true);
  });

  it('is false when the variable is unset, which is the production default', () => {
    delete process.env.SITE_ENV;
    expect(isStaging()).toBe(false);
  });

  // The failure that would matter: a truthiness check rather than an equality
  // check would de-index production the moment SITE_ENV held any other value.
  it('is false for any other non-empty value', () => {
    for (const value of ['production', 'prod', 'true', '1', 'Staging']) {
      process.env.SITE_ENV = value;
      expect(isStaging(), `SITE_ENV=${value}`).toBe(false);
    }
  });
});
