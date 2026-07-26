import { describe, expect, it } from 'vitest';
import { deriveTable, tableSnippet, type StandingsInput } from '../../src/lib/standings';

function row(overrides: Partial<StandingsInput> & { team: string }): StandingsInput {
  return {
    name: overrides.team.toUpperCase(),
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...overrides,
  };
}

describe('deriveTable', () => {
  it('derives played, points and goal difference rather than trusting stored values', () => {
    const [entry] = deriveTable([
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2, goalsFor: 19, goalsAgainst: 11 }),
    ]);

    expect(entry.played).toBe(11);
    expect(entry.points).toBe(21);
    expect(entry.goalDifference).toBe(8);
  });

  it('handles a negative goal difference', () => {
    const [entry] = deriveTable([
      row({ team: 'penang', won: 1, drawn: 2, lost: 8, goalsFor: 7, goalsAgainst: 24 }),
    ]);

    expect(entry.goalDifference).toBe(-17);
    expect(entry.points).toBe(5);
  });

  it('orders by points descending and assigns positions from 1', () => {
    const table = deriveTable([
      row({ team: 'sabah', won: 3, drawn: 4, lost: 4 }),
      row({ team: 'jdt', won: 9, drawn: 2, lost: 0 }),
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['jdt', 'kedah', 'sabah']);
    expect(table.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it('breaks a points tie on goal difference', () => {
    const table = deriveTable([
      row({ team: 'selangor', won: 6, drawn: 3, lost: 2, goalsFor: 17, goalsAgainst: 12 }),
      row({ team: 'kedah', won: 6, drawn: 3, lost: 2, goalsFor: 19, goalsAgainst: 11 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['kedah', 'selangor']);
  });

  it('breaks a goal-difference tie on goals scored', () => {
    const table = deriveTable([
      row({ team: 'alpha', won: 4, drawn: 0, lost: 0, goalsFor: 8, goalsAgainst: 4 }),
      row({ team: 'bravo', won: 4, drawn: 0, lost: 0, goalsFor: 12, goalsAgainst: 8 }),
    ]);

    expect(table.map((e) => e.team)).toEqual(['bravo', 'alpha']);
  });

  it('breaks a total tie alphabetically by name so the order is stable across builds', () => {
    const table = deriveTable([
      { ...row({ team: 'zulu' }), name: 'Zulu FC', won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 5 },
      { ...row({ team: 'alpha' }), name: 'Alpha FC', won: 2, drawn: 1, lost: 1, goalsFor: 5, goalsAgainst: 5 },
    ]);

    expect(table.map((e) => e.team)).toEqual(['alpha', 'zulu']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ team: 'sabah', won: 1 }), row({ team: 'jdt', won: 9 })];
    deriveTable(rows);
    expect(rows.map((r) => r.team)).toEqual(['sabah', 'jdt']);
  });

  it('returns an empty table for no rows', () => {
    expect(deriveTable([])).toEqual([]);
  });
});

describe('tableSnippet', () => {
  const table = deriveTable([
    row({ team: 'jdt', won: 9, drawn: 2 }),
    row({ team: 'selangor', won: 7, drawn: 0 }),
    row({ team: 'terengganu', won: 6, drawn: 1 }),
    row({ team: 'sabah', won: 5, drawn: 2 }),
    row({ team: 'penang', won: 4, drawn: 1 }),
    row({ team: 'kedah', won: 2, drawn: 1 }),
  ]);

  it('returns the top N when the club is already inside them', () => {
    const snippet = tableSnippet(table, 'jdt', 3);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor', 'terengganu']);
  });

  it('appends the club row when the club sits outside the top N', () => {
    const snippet = tableSnippet(table, 'kedah', 3);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor', 'terengganu', 'kedah']);
  });

  it('never duplicates the club row', () => {
    const snippet = tableSnippet(table, 'selangor', 5);
    expect(snippet.filter((e) => e.team === 'selangor')).toHaveLength(1);
  });

  it('returns the whole table when the limit exceeds its length', () => {
    expect(tableSnippet(table, 'kedah', 50)).toHaveLength(6);
  });

  it('returns the top N unchanged when the club is not in the table at all', () => {
    const snippet = tableSnippet(table, 'unknown-club', 2);
    expect(snippet.map((e) => e.team)).toEqual(['jdt', 'selangor']);
  });
});
