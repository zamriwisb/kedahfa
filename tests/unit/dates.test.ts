import { describe, expect, it } from 'vitest';
import {
  countdown,
  formatArticleDate,
  formatKickoffTime,
  formatMatchDate,
  formatMonthHeading,
  monthKey,
} from '../../src/lib/dates';

const EVENING_KICKOFF = new Date('2026-08-02T20:45:00+08:00');
const AFTER_MIDNIGHT = new Date('2026-08-03T00:30:00+08:00');

describe('test environment', () => {
  it('runs in UTC so timezone bugs are reproducible', () => {
    expect(process.env.TZ).toBe('UTC');
  });
});

describe('formatKickoffTime', () => {
  it('formats an evening kickoff in Kuala Lumpur time, not UTC', () => {
    // 20:45+08:00 is 12:45 UTC. A naive formatter would print 12:45.
    expect(formatKickoffTime(EVENING_KICKOFF)).toBe('20:45');
  });

  it('renders midnight as 00:00, not 24:00', () => {
    expect(formatKickoffTime(new Date('2026-08-03T00:00:00+08:00'))).toBe('00:00');
  });
});

describe('formatMatchDate', () => {
  it('formats a standard kickoff', () => {
    expect(formatMatchDate(EVENING_KICKOFF)).toBe('Sun 02 Aug 2026');
  });

  it('keeps the local calendar day when UTC is still on the previous date', () => {
    // 00:30+08:00 on 3 Aug is 16:30 UTC on 2 Aug.
    expect(formatMatchDate(AFTER_MIDNIGHT)).toBe('Mon 03 Aug 2026');
  });
});

describe('formatArticleDate', () => {
  it('formats a publication date in long form without a leading zero', () => {
    expect(formatArticleDate(new Date('2026-07-19T16:00:00+08:00'))).toBe('19 July 2026');
  });
});

describe('formatMonthHeading', () => {
  it('formats a month and year for fixture list headings', () => {
    expect(formatMonthHeading(EVENING_KICKOFF)).toBe('August 2026');
  });
});

describe('monthKey', () => {
  it('produces a sortable key from the local month', () => {
    expect(monthKey(EVENING_KICKOFF)).toBe('2026-08');
  });

  it('assigns an after-midnight kickoff to its local month', () => {
    expect(monthKey(new Date('2026-09-01T00:30:00+08:00'))).toBe('2026-09');
  });
});

describe('countdown', () => {
  it('breaks the remaining time into days, hours, minutes and seconds', () => {
    const from = new Date('2026-07-29T09:23:15+08:00');
    expect(countdown(from, EVENING_KICKOFF)).toEqual({
      days: 4,
      hours: 11,
      minutes: 21,
      seconds: 45,
    });
  });

  it('returns null once the target has passed', () => {
    expect(countdown(new Date('2026-08-02T20:46:00+08:00'), EVENING_KICKOFF)).toBeNull();
  });

  it('returns null at the exact kickoff moment', () => {
    expect(countdown(EVENING_KICKOFF, EVENING_KICKOFF)).toBeNull();
  });
});
