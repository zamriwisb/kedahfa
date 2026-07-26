import { describe, expect, it } from 'vitest';
import {
  finishedMatches,
  groupByMonth,
  nextMatch,
  outcomeFor,
  recentResults,
  selectHero,
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

const ALL = [
  TERENGGANU_AWAY,
  PENANG_AWAY_WIN,
  POSTPONED_CUP,
  SELANGOR_HOME_WIN,
  JDT_HOME,
  SABAH_HOME_DRAW,
];

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

describe('selectHero', () => {
  it('shows the latest result when it is within the five-day window', () => {
    const hero = selectHero(ALL, new Date('2026-07-21T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'result', match: SELANGOR_HOME_WIN });
  });

  it('shows the next fixture once the latest result is older than five days', () => {
    const hero = selectHero(ALL, new Date('2026-07-26T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'fixture', match: JDT_HOME });
  });

  it('still shows the result at exactly the window boundary', () => {
    // SELANGOR_HOME_WIN kicked off 2026-07-19T20:45+08:00, so this is 5.0 days
    // later to the second. The comparison is <=, so the result still wins.
    const exactlyFiveDays = new Date('2026-07-24T20:45:00+08:00');
    expect(selectHero(ALL, exactlyFiveDays)).toEqual({
      kind: 'result',
      match: SELANGOR_HOME_WIN,
    });
  });

  it('switches to the next fixture one minute past the boundary', () => {
    // Pins the off-by-one: with `<` instead of `<=` the previous test fails,
    // and with `<=` on a stale bound this one does.
    const justPast = new Date('2026-07-24T20:46:00+08:00');
    expect(selectHero(ALL, justPast)).toEqual({ kind: 'fixture', match: JDT_HOME });
  });

  it('falls back to the latest result when no fixtures remain', () => {
    const hero = selectHero(ALL, new Date('2026-12-01T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'result', match: SELANGOR_HOME_WIN });
  });

  it('returns null when there is no content at all', () => {
    expect(selectHero([], new Date('2026-07-26T09:00:00+08:00'))).toBeNull();
  });

  it('shows the next fixture when nothing has been played yet', () => {
    const hero = selectHero([JDT_HOME], new Date('2026-07-26T09:00:00+08:00'));
    expect(hero).toEqual({ kind: 'fixture', match: JDT_HOME });
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
