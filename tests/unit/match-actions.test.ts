import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import MatchActions from '../../src/components/MatchActions.astro';
import type { Match } from '../../src/lib/fixtures';

const CLUB = 'kedah';
const NOW = new Date('2026-07-25T12:00:00+08:00');

// Sellable on its own terms (upcoming, at home) regardless of which action
// URL shape is under test below — see sellableMatch's own unit tests in
// fixtures.test.ts for that rule in isolation.
function sellableHomeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'home-fixture',
    competition: 'A1 Semi-Pro League',
    date: new Date('2026-08-02T20:45:00+08:00'),
    venue: 'Darul Aman Stadium',
    home: CLUB,
    away: 'jdt-ii',
    status: 'scheduled',
    ...overrides,
  };
}

// The spec's two link shapes, exercised here at the component level because
// every seeded fixture in src/data/fixtures.yaml is https://, so the
// site-relative branch has no coverage anywhere else. Container-rendering
// MatchActions directly, rather than adding a site-relative URL to the seed
// data, keeps that data honest about what the club's real links look like.
describe('MatchActions link target', () => {
  it('opens an https:// link in a new tab with rel and an sr-only note', async () => {
    const container = await AstroContainer.create();
    const match = sellableHomeMatch({ tickets: 'https://tickets.example.com/kedah-jdt-ii' });

    const result = await container.renderToString(MatchActions, {
      props: { match, clubSlug: CLUB, now: NOW },
    });

    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('opens in a new tab');
  });

  it('keeps a site-relative link in-tab with neither target/rel nor the sr-only note', async () => {
    const container = await AstroContainer.create();
    const match = sellableHomeMatch({ tickets: '/tickets/kedah-jdt-ii' });

    const result = await container.renderToString(MatchActions, {
      props: { match, clubSlug: CLUB, now: NOW },
    });

    expect(result).toContain('href="/tickets/kedah-jdt-ii"');
    expect(result).not.toContain('target=');
    expect(result).not.toContain('rel=');
    expect(result).not.toContain('opens in a new tab');
  });
});
