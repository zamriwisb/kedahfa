import { formatMonthHeading, monthKey } from './dates';

export type MatchStatus = 'scheduled' | 'finished' | 'postponed';

export interface MatchScore {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  competition: string;
  matchweek?: number;
  date: Date;
  venue: string;
  home: string;
  away: string;
  status: MatchStatus;
  score?: MatchScore;
  report?: string;
}

/** How recent a result must be to outrank the next fixture on the homepage. */
export const HERO_RESULT_WINDOW_DAYS = 5;

const MS_PER_DAY = 86_400_000;

const byDateAscending = (a: Match, b: Match) => a.date.getTime() - b.date.getTime();
const byDateDescending = (a: Match, b: Match) => b.date.getTime() - a.date.getTime();

/**
 * Postponed matches are deliberately excluded: their stored date is stale,
 * so listing one as "upcoming" would advertise a kickoff that will not happen.
 */
export function upcomingMatches(all: Match[], now: Date): Match[] {
  return all
    .filter((m) => m.status === 'scheduled' && m.date.getTime() > now.getTime())
    .sort(byDateAscending);
}

export function finishedMatches(all: Match[]): Match[] {
  return all.filter((m) => m.status === 'finished').sort(byDateDescending);
}

export function nextMatch(all: Match[], now: Date): Match | null {
  return upcomingMatches(all, now)[0] ?? null;
}

export function recentResults(all: Match[], limit: number): Match[] {
  return finishedMatches(all).slice(0, limit);
}

export function outcomeFor(match: Match, clubSlug: string): 'W' | 'D' | 'L' | null {
  if (!match.score) return null;

  const scored =
    match.home === clubSlug
      ? match.score.home
      : match.away === clubSlug
        ? match.score.away
        : null;

  if (scored === null) return null;

  const conceded =
    match.home === clubSlug ? match.score.away : match.score.home;

  if (scored > conceded) return 'W';
  if (scored < conceded) return 'L';
  return 'D';
}

export type Hero = { kind: 'result' | 'fixture'; match: Match } | null;

/**
 * The hero reflects the club's current state: a fresh result while it is still
 * news, otherwise what is coming next, otherwise the last thing that happened.
 */
export function selectHero(all: Match[], now: Date): Hero {
  const latestResult = finishedMatches(all)[0] ?? null;

  if (latestResult) {
    const ageDays = (now.getTime() - latestResult.date.getTime()) / MS_PER_DAY;
    if (ageDays >= 0 && ageDays <= HERO_RESULT_WINDOW_DAYS) {
      return { kind: 'result', match: latestResult };
    }
  }

  const upcoming = nextMatch(all, now);
  if (upcoming) return { kind: 'fixture', match: upcoming };
  if (latestResult) return { kind: 'result', match: latestResult };
  return null;
}

export interface MonthGroup {
  key: string;
  heading: string;
  matches: Match[];
}

export function groupByMonth(matches: Match[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();

  for (const m of [...matches].sort(byDateAscending)) {
    const key = monthKey(m.date);
    const existing = groups.get(key);
    if (existing) {
      existing.matches.push(m);
    } else {
      groups.set(key, { key, heading: formatMonthHeading(m.date), matches: [m] });
    }
  }

  return [...groups.values()];
}
