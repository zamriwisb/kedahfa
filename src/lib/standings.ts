/**
 * Only match observations are stored in standings.yaml. Played, points and
 * goal difference are derived here so a hand-edited table cannot contain
 * arithmetic that does not add up.
 */
export interface StandingsInput {
  team: string;
  name: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TableEntry extends StandingsInput {
  played: number;
  points: number;
  goalDifference: number;
  position: number;
}

const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;

export function deriveTable(rows: StandingsInput[]): TableEntry[] {
  return rows
    .map((row) => ({
      ...row,
      played: row.won + row.drawn + row.lost,
      points: row.won * POINTS_FOR_WIN + row.drawn * POINTS_FOR_DRAW,
      goalDifference: row.goalsFor - row.goalsAgainst,
      position: 0,
    }))
    // Sorts a fresh array, so the caller's input is untouched.
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        // Final tie-break keeps build output deterministic.
        a.name.localeCompare(b.name),
    )
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * The homepage shows the top of the table. If the club is not in that slice,
 * its row is appended so a supporter always sees where the side stands.
 */
export function tableSnippet(
  table: TableEntry[],
  clubSlug: string,
  limit: number,
): TableEntry[] {
  const top = table.slice(0, limit);
  if (top.some((entry) => entry.team === clubSlug)) return top;

  const clubRow = table.find((entry) => entry.team === clubSlug);
  return clubRow ? [...top, clubRow] : top;
}
