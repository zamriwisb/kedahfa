import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// js-yaml@5 ships only named ESM exports — see the note in src/lib/validate.ts.
import { load } from 'js-yaml';
import { SUPPORTED_PLATFORMS, socialIcon } from '../../src/lib/social';

describe('socialIcon', () => {
  it('returns the Font Awesome geometry for a known platform', () => {
    const icon = socialIcon('Facebook');

    expect(icon.width).toBeGreaterThan(0);
    expect(icon.height).toBeGreaterThan(0);
    expect(icon.path).toMatch(/^[Mm]/);
  });

  it('matches platform names case-insensitively', () => {
    expect(socialIcon('instagram')).toEqual(socialIcon('Instagram'));
    expect(socialIcon('INSTAGRAM')).toEqual(socialIcon('Instagram'));
  });

  it('accepts the aliases a content editor is likely to type', () => {
    // The club may write either the current or the former name of the network.
    expect(socialIcon('Twitter')).toEqual(socialIcon('X'));
  });

  // The old header fell back to a generic globe glyph, so a typo shipped a
  // meaningless circle. Failing loudly is the point of this function.
  it('throws on an unknown platform rather than falling back to a glyph', () => {
    expect(() => socialIcon('Friendster')).toThrow(/Friendster/);
  });

  it('names the supported platforms in the error, so the fix is obvious', () => {
    expect(() => socialIcon('Friendster')).toThrow(/facebook/);
  });

  it('covers every platform listed in club.yaml', () => {
    const clubFile = readFileSync(join(process.cwd(), 'src/data/club.yaml'), 'utf8');
    const [club] = load(clubFile) as { socials: { platform: string }[] }[];

    for (const social of club.socials) {
      expect(() => socialIcon(social.platform)).not.toThrow();
    }
  });

  it('exposes the supported platforms in lowercase for the error message', () => {
    expect(SUPPORTED_PLATFORMS).toContain('facebook');
    expect(SUPPORTED_PLATFORMS.every((name) => name === name.toLowerCase())).toBe(true);
  });
});
