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
  /** Where to buy tickets for this match. Rendered only under sellableMatch's rules. */
  tickets?: string;
  /** Where to watch the pay-per-view stream. Same rules. */
  stream?: string;
}

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

/**
 * Scheduled matches whose kickoff has already passed but which have not yet
 * been marked finished — most likely a result nobody has committed yet.
 * Without this bucket such a match falls between upcomingMatches (requires a
 * future date) and finishedMatches (requires status === 'finished') and
 * disappears from the site entirely.
 *
 * Postponed matches are excluded for the same reason upcomingMatches excludes
 * them: their stored date is stale.
 */
export function awaitingResult(all: Match[], now: Date): Match[] {
  return all
    .filter((m) => m.status === 'scheduled' && m.date.getTime() <= now.getTime())
    .sort(byDateDescending);
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

/**
 * Whether a match is one this club can sell to: an upcoming fixture at home.
 *
 * The first two conditions are upcomingMatches()' predicate — scheduled, and
 * kickoff still ahead — so postponed fixtures (stale stored date) and matches
 * awaiting a result are both excluded for the reasons documented there. The
 * third is the club's own rule: tickets and the stream for an away match
 * belong to the host club, so this site does not offer them.
 *
 * URL presence is deliberately NOT checked here. Which of the two buttons a
 * card shows depends on which URL is set, and that belongs to the component
 * rendering them; this answers only "may this match carry them at all".
 */
export function sellableMatch(match: Match, clubSlug: string, now: Date): boolean {
  return (
    match.status === 'scheduled' &&
    match.date.getTime() > now.getTime() &&
    match.home === clubSlug
  );
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
