import { describe, expect, it } from 'vitest';
import {
  awaitingResult,
  finishedMatches,
  groupByMonth,
  nextMatch,
  outcomeFor,
  recentResults,
  sellableMatch,
  upcomingMatches,
  type Match,
} from '../../src/lib/fixtures';

const CLUB = 'kedah';

// `date` is Omit-ted from Partial<Match> before intersecting: Match.date is a
// Date, and intersecting `date?: Date` with `date: string` resolves to `never`,
// which makes every call site a type error under strict mode.
function match(
  overrides: Omit<Partial<Match>, 'date'> & { id: string; date: string },
): Match {
  return {
    competition: 'Super League',
    venue: 'Darul Aman Stadium',
    home: CLUB,
    away: 'sabah',
    status: 'scheduled',
    ...overrides,
    date: new Date(overrides.date),
  };
}

const PENANG_AWAY_WIN = match({
  id: 'penang-a',
  date: '2026-06-28T20:15:00+08:00',
  home: 'penang',
  away: CLUB,
  status: 'finished',
  score: { home: 0, away: 2 },
});

const SABAH_HOME_DRAW = match({
  id: 'sabah-h',
  date: '2026-07-05T20:45:00+08:00',
  away: 'sabah',
  status: 'finished',
  score: { home: 1, away: 1 },
});

const SELANGOR_HOME_WIN = match({
  id: 'selangor-h',
  date: '2026-07-19T20:45:00+08:00',
  away: 'selangor',
  status: 'finished',
  score: { home: 3, away: 2 },
});

const JDT_HOME = match({ id: 'jdt-h', date: '2026-08-02T20:45:00+08:00', away: 'jdt' });

const TERENGGANU_AWAY = match({
  id: 'terengganu-a',
  date: '2026-08-15T18:00:00+08:00',
  home: 'terengganu',
  away: CLUB,
});

const POSTPONED_CUP = match({
  id: 'penang-cup',
  date: '2026-08-29T20:45:00+08:00',
  competition: 'Malaysia Cup',
  away: 'penang',
  status: 'postponed',
});

// Kickoff has passed but nobody has committed the score yet.
const OVERDUE_SABAH = match({
  id: 'overdue-sabah',
  date: '2026-07-10T20:45:00+08:00',
  away: 'sabah',
});

const OVERDUE_SELANGOR = match({
  id: 'overdue-selangor',
  date: '2026-07-15T20:45:00+08:00',
  away: 'selangor',
});

const ALL = [
  TERENGGANU_AWAY,
  PENANG_AWAY_WIN,
  POSTPONED_CUP,
  SELANGOR_HOME_WIN,
  JDT_HOME,
  SABAH_HOME_DRAW,
];

const ALL_WITH_OVERDUE = [...ALL, OVERDUE_SABAH, OVERDUE_SELANGOR];

describe('upcomingMatches', () => {
  it('returns only future scheduled matches, soonest first', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).toEqual(['jdt-h', 'terengganu-a']);
  });

  it('excludes postponed matches even when their date is in the future', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).not.toContain('penang-cup');
  });

  it('drops a scheduled match once its kickoff has passed', () => {
    const now = new Date('2026-08-02T21:00:00+08:00');
    expect(upcomingMatches(ALL, now).map((m) => m.id)).toEqual(['terengganu-a']);
  });
});

describe('awaitingResult', () => {
  it('returns a scheduled match whose kickoff has passed', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(awaitingResult(ALL_WITH_OVERDUE, now).map((m) => m.id)).toContain('overdue-sabah');
  });

  it('excludes a scheduled match whose kickoff is still in the future', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(awaitingResult(ALL_WITH_OVERDUE, now).map((m) => m.id)).not.toContain('jdt-h');
  });

  it('excludes a match that already has a recorded result', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(awaitingResult(ALL_WITH_OVERDUE, now).map((m) => m.id)).not.toContain('sabah-h');
  });

  it('excludes a postponed match, whose stored date is stale', () => {
    // POSTPONED_CUP's date (2026-08-29) is in the future here, but even a
    // postponed match with a past stored date must not surface: the date is
    // stale by definition once a fixture is postponed.
    const now = new Date('2026-09-01T12:00:00+08:00');
    expect(awaitingResult(ALL_WITH_OVERDUE, now).map((m) => m.id)).not.toContain('penang-cup');
  });

  it('orders results most-recent-first', () => {
    const now = new Date('2026-07-25T12:00:00+08:00');
    expect(awaitingResult(ALL_WITH_OVERDUE, now).map((m) => m.id)).toEqual([
      'overdue-selangor',
      'overdue-sabah',
    ]);
  });

  it('includes a match whose kickoff is exactly now', () => {
    const now = OVERDUE_SABAH.date;
    expect(awaitingResult([OVERDUE_SABAH], now).map((m) => m.id)).toEqual(['overdue-sabah']);
  });

  it('returns an empty array for no matches', () => {
    expect(awaitingResult([], new Date('2026-07-25T12:00:00+08:00'))).toEqual([]);
  });
});

describe('finishedMatches', () => {
  it('returns finished matches most recent first', () => {
    expect(finishedMatches(ALL).map((m) => m.id)).toEqual(['selangor-h', 'sabah-h', 'penang-a']);
  });
});

describe('nextMatch', () => {
  it('returns the soonest upcoming match', () => {
    expect(nextMatch(ALL, new Date('2026-07-25T12:00:00+08:00'))?.id).toBe('jdt-h');
  });

  it('returns null when the season has no scheduled matches left', () => {
    expect(nextMatch(ALL, new Date('2026-12-01T12:00:00+08:00'))).toBeNull();
  });
});

describe('recentResults', () => {
  it('returns the most recent results up to the limit', () => {
    expect(recentResults(ALL, 2).map((m) => m.id)).toEqual(['selangor-h', 'sabah-h']);
  });

  it('returns everything available when fewer results exist than the limit', () => {
    expect(recentResults(ALL, 10)).toHaveLength(3);
  });
});

describe('outcomeFor', () => {
  it('reads a win from an away scoreline', () => {
    expect(outcomeFor(PENANG_AWAY_WIN, CLUB)).toBe('W');
  });

  it('reads a win from a home scoreline', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, CLUB)).toBe('W');
  });

  it('reads a draw', () => {
    expect(outcomeFor(SABAH_HOME_DRAW, CLUB)).toBe('D');
  });

  it('reads a loss from the opponent perspective', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, 'selangor')).toBe('L');
  });

  it('returns null for a match with no score', () => {
    expect(outcomeFor(JDT_HOME, CLUB)).toBeNull();
  });

  it('returns null for a club that did not play in the match', () => {
    expect(outcomeFor(SELANGOR_HOME_WIN, 'jdt')).toBeNull();
  });
});

describe('groupByMonth', () => {
  it('groups matches under Kuala Lumpur month headings in chronological order', () => {
    const groups = groupByMonth([SELANGOR_HOME_WIN, JDT_HOME, PENANG_AWAY_WIN]);

    expect(groups.map((g) => g.heading)).toEqual(['June 2026', 'July 2026', 'August 2026']);
    expect(groups.map((g) => g.matches.length)).toEqual([1, 1, 1]);
  });

  it('places an after-midnight kickoff in its local month, not the UTC one', () => {
    // 00:30+08:00 on 1 September is 16:30 UTC on 31 August.
    const rollover = match({ id: 'rollover', date: '2026-09-01T00:30:00+08:00' });
    const [group] = groupByMonth([rollover]);

    expect(group.heading).toBe('September 2026');
    // The key is what actually groups matches. Asserting only the heading
    // would miss a raw getMonth() implementation: formatMonthHeading would
    // still print "September 2026" while the key silently said 2026-08.
    expect(group.key).toBe('2026-09');
  });

  it('does not merge two matches that share a UTC month but not a local one', () => {
    // Both of these are 31 August in UTC (15:00 and 16:30), but they fall in
    // different months in Kuala Lumpur. A UTC-based key collapses them into
    // one group; a correct key keeps them apart.
    const august = match({ id: 'aug', date: '2026-08-31T23:00:00+08:00' });
    const september = match({ id: 'sep', date: '2026-09-01T00:30:00+08:00' });

    const groups = groupByMonth([august, september]);

    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-09']);
    expect(groups.map((g) => g.matches.length)).toEqual([1, 1]);
  });

  it('returns an empty array for no matches', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('sellableMatch', () => {
  const NOW = new Date('2026-07-25T12:00:00+08:00');

  it('accepts an upcoming home fixture', () => {
    expect(sellableMatch(JDT_HOME, CLUB, NOW)).toBe(true);
  });

  it('rejects an away fixture: those tickets are the host club to sell', () => {
    expect(sellableMatch(TERENGGANU_AWAY, CLUB, NOW)).toBe(false);
  });

  it('rejects a home fixture whose kickoff has passed', () => {
    expect(sellableMatch(JDT_HOME, CLUB, new Date('2026-08-02T21:00:00+08:00'))).toBe(false);
  });

  it('rejects a home fixture kicking off exactly now', () => {
    expect(sellableMatch(JDT_HOME, CLUB, JDT_HOME.date)).toBe(false);
  });

  it('rejects a finished home match', () => {
    expect(sellableMatch(SELANGOR_HOME_WIN, CLUB, new Date('2026-07-01T12:00:00+08:00'))).toBe(
      false,
    );
  });

  it('rejects a postponed home match even though its stored date is ahead', () => {
    expect(sellableMatch(POSTPONED_CUP, CLUB, NOW)).toBe(false);
  });

  it('rejects a home match still awaiting its result', () => {
    expect(sellableMatch(OVERDUE_SABAH, CLUB, NOW)).toBe(false);
  });

  it('does not care whether any URL is set — that is the component job', () => {
    const withLink = match({
      id: 'with-link',
      date: '2026-08-02T20:45:00+08:00',
      tickets: 'https://example.com/tickets',
    });
    expect(sellableMatch(withLink, CLUB, NOW)).toBe(true);
    expect(sellableMatch(JDT_HOME, CLUB, NOW)).toBe(true);
  });
});
