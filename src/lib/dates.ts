/**
 * All club-facing dates and times are rendered in Malaysian time.
 * CI builds run in UTC, so every format here pins the timezone explicitly —
 * an unqualified formatter would shift a 20:45 kickoff to the previous day.
 */
export const CLUB_TIMEZONE = 'Asia/Kuala_Lumpur';

type PartMap = Record<string, string>;

/**
 * Builds the string from individual Intl parts rather than the joined output.
 * Part values are stable across ICU versions; the joined form (separators,
 * comma placement) is not.
 */
function partsIn(date: Date, options: Intl.DateTimeFormatOptions): PartMap {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIMEZONE,
    ...options,
  });
  const map: PartMap = {};
  for (const part of formatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  return map;
}

export function formatKickoffTime(date: Date): string {
  // hourCycle h23 rather than hour12:false — the latter can yield "24:00".
  const p = partsIn(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}

export function formatMatchDate(date: Date): string {
  const p = partsIn(date, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

export function formatArticleDate(date: Date): string {
  const p = partsIn(date, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatMonthHeading(date: Date): string {
  const p = partsIn(date, { month: 'long', year: 'numeric' });
  return `${p.month} ${p.year}`;
}

export function monthKey(date: Date): string {
  const p = partsIn(date, { year: 'numeric', month: '2-digit' });
  return `${p.year}-${p.month}`;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;

export function countdown(from: Date, to: Date): Countdown | null {
  const remainingMs = to.getTime() - from.getTime();
  if (remainingMs <= 0) return null;

  const total = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(total / SECONDS_PER_DAY),
    hours: Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / 60),
    seconds: total % 60,
  };
}
