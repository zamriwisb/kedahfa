import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// js-yaml@5 ships only named ESM exports — a default import is undefined here.
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  crest: string;
}

interface StandingsRow {
  id: string;
  team: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

function readYaml<T>(relativePath: string): T[] {
  return load(readFileSync(join(ROOT, relativePath), 'utf-8')) as T[];
}

const teams = readYaml<TeamRow>('src/data/teams.yaml');
const standings = readYaml<StandingsRow>('src/data/standings.yaml');

describe('src/data/teams.yaml', () => {
  it('lists the twelve A1 Semi-Pro 2026/27 clubs', () => {
    expect(teams).toHaveLength(12);
  });

  it('keeps Kedah on the slug the club pages and homepage table key off', () => {
    expect(teams.map((t) => t.id)).toContain('kedah');
  });

  it('has no duplicate slugs', () => {
    expect(new Set(teams.map((t) => t.id)).size).toBe(teams.length);
  });

  it('keeps every shortName within the four-character schema cap', () => {
    const tooLong = teams.filter((t) => t.shortName.length > 4);
    expect(tooLong.map((t) => t.id)).toEqual([]);
  });

  it('points every crest at a file that exists in public/', () => {
    const missing = teams.filter(
      (t) => !existsSync(join(ROOT, 'public', t.crest.replace(/^\//, ''))),
    );
    expect(missing.map((t) => t.crest)).toEqual([]);
  });
});

describe('src/data/standings.yaml', () => {
  it('has exactly one row per team, and no rows for departed clubs', () => {
    expect(standings.map((r) => r.team).sort()).toEqual(teams.map((t) => t.id).sort());
  });

  it('uses each row id as its own team slug, as the schema requires', () => {
    const mismatched = standings.filter((r) => r.id !== r.team);
    expect(mismatched.map((r) => r.id)).toEqual([]);
  });

  it('is zeroed because the season has not kicked off', () => {
    const played = standings.filter(
      (r) => r.won + r.drawn + r.lost + r.goalsFor + r.goalsAgainst !== 0,
    );
    expect(played.map((r) => r.id)).toEqual([]);
  });
});

interface FixtureRow {
  id: string;
  home: string;
  away: string;
  status: string;
  score?: unknown;
}

describe('src/data/fixtures.yaml', () => {
  const fixtures = readYaml<FixtureRow>('src/data/fixtures.yaml');

  it('parses as an array, which the loader requires', () => {
    // A comments-only file parses to null, and both parseFixturesYaml
    // (src/content.config.ts:19) and assertNoDuplicateIds
    // (src/lib/validate.ts:54) throw on a non-array. Whether the schedule is
    // empty or full, the file has to be a real YAML list.
    expect(Array.isArray(fixtures)).toBe(true);
  });

  it('names only clubs that are in the league', () => {
    const slugs = new Set(teams.map((t) => t.id));
    const unknown = fixtures.flatMap((f) =>
      [f.home, f.away].filter((slug) => !slugs.has(slug)),
    );
    expect(unknown).toEqual([]);
  });

  it('never has a club playing itself', () => {
    expect(fixtures.filter((f) => f.home === f.away).map((f) => f.id)).toEqual([]);
  });

  it('carries no scores while the table is still zeroed', () => {
    // The placeholder schedule is entirely `scheduled`. A finished match with
    // a score would contradict standings.yaml, where every row reads zero.
    const played = fixtures.filter((f) => f.status !== 'scheduled' || f.score !== undefined);
    expect(played.map((f) => f.id)).toEqual([]);
  });
});
