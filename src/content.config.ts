import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
// js-yaml@5 ships only named ESM exports (no default export) — a default
// import resolves to undefined under Vite/Astro's native ESM handling.
import { load } from 'js-yaml';

// Astro's file() loader parses YAML with js-yaml's default schema, which
// implicitly resolves bare timestamps (e.g. "2026-08-02T20:45:00") to Date
// objects — treating a missing offset as UTC — before this schema ever runs.
// That silently discards the distinction between "written with +08:00" and
// "written with no offset at all", so z.coerce.date() can never reject the
// latter. This custom parser keeps fixtures.yaml's scalars as plain strings
// (js-yaml's default `load()` — no schema option — does not auto-convert
// timestamps, verified against the installed js-yaml@5.2.2), so the `date`
// field below can enforce an explicit offset itself.
function parseFixturesYaml(text: string): Record<string, unknown>[] {
  const data = load(text);
  if (!Array.isArray(data)) {
    throw new Error('src/data/fixtures.yaml must contain a YAML array of fixture entries.');
  }
  return data as Record<string, unknown>[];
}

// A date-time with no explicit offset builds clean and renders the wrong
// time and day (see the comment on parseFixturesYaml above). Require "Z" or
// a numeric offset so a missing one fails the build instead of the page.
const FIXTURE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const FIXTURE_DATE_MESSAGE =
  'Fixture date must include an explicit UTC offset or "Z", e.g. "2026-08-02T20:45:00+08:00". ' +
  'A bare local time like "2026-08-02T20:45:00" builds successfully but renders the wrong time and day.';

// Calendar dates — a news article's publish day, a player's birth day, the
// day standings were last updated — name a day, not an instant, so a value
// carrying a time-of-day is a content error rather than a legitimate value.
// z.coerce.date() parses a plain "2026-07-19" as exactly UTC midnight and
// any value with an actual time component (bare local time, or an explicit
// non-zero offset) as something else, so validating the parsed Date's UTC
// clock fields is equivalent to requiring a date-only source string — the
// same hazard the fixture `date` field above guards against with a regex on
// the raw string, but these fields lose that raw string to js-yaml/Zod
// coercion before this schema runs, so the check has to live after coercion.
function dateOnly(fieldLabel: string) {
  return z.coerce.date().refine(
    (d) =>
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0 &&
      d.getUTCMilliseconds() === 0,
    {
      message: `${fieldLabel} must be a plain date with no time component, e.g. "2026-07-19".`,
    },
  );
}

const club = defineCollection({
  loader: file('src/data/club.yaml'),
  schema: z.object({
    id: z.literal('club'),
    name: z.string(),
    shortName: z.string(),
    founded: z.number().int(),
    stadium: z.string(),
    stadiumCapacity: z.number().int().positive(),
    city: z.string(),
    emails: z.array(z.object({ label: z.string(), address: z.email() })).min(1),
    phone: z.string(),
    socials: z.array(z.object({ platform: z.string(), url: z.url() })),
  }),
});

const season = defineCollection({
  loader: file('src/data/season.yaml'),
  schema: z.object({
    id: z.literal('current'),
    competition: z.string(),
    standingsUpdated: dateOnly('standingsUpdated'),
  }),
});

const teams = defineCollection({
  loader: file('src/data/teams.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    shortName: z.string().max(4),
    crest: z.string().startsWith('/images/teams/'),
  }),
});

const fixtures = defineCollection({
  loader: file('src/data/fixtures.yaml', { parser: parseFixturesYaml }),
  schema: z
    .object({
      id: z.string(),
      competition: z.string(),
      matchweek: z.number().int().positive().optional(),
      date: z.string().regex(FIXTURE_DATE_PATTERN, FIXTURE_DATE_MESSAGE).pipe(z.coerce.date()),
      venue: z.string(),
      home: reference('teams'),
      away: reference('teams'),
      status: z.enum(['scheduled', 'finished', 'postponed']),
      score: z
        .object({
          home: z.number().int().min(0),
          away: z.number().int().min(0),
        })
        .optional(),
      report: reference('news').optional(),
    })
    .refine((m) => (m.status === 'finished' ? m.score !== undefined : m.score === undefined), {
      message: 'A finished match requires a score; a scheduled or postponed match must not have one.',
      path: ['score'],
    })
    .refine((m) => m.home.id !== m.away.id, {
      message: 'A team cannot play itself.',
      path: ['away'],
    }),
});

const standings = defineCollection({
  loader: file('src/data/standings.yaml'),
  schema: z
    .object({
      id: z.string(),
      team: reference('teams'),
      won: z.number().int().min(0),
      drawn: z.number().int().min(0),
      lost: z.number().int().min(0),
      goalsFor: z.number().int().min(0),
      goalsAgainst: z.number().int().min(0),
    })
    .refine((row) => row.id === row.team.id, {
      message: 'A standings row id must equal its team slug.',
      path: ['id'],
    }),
});

const squad = defineCollection({
  loader: file('src/data/squad.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    number: z.number().int().min(1).max(99),
    position: z.enum(['Goalkeeper', 'Defender', 'Midfielder', 'Forward']),
    nationality: z.string().length(2),
    dateOfBirth: dateOnly('dateOfBirth'),
    heightCm: z.number().int().min(140).max(220),
    photo: z.string().startsWith('/images/squad/'),
    joined: z.number().int(),
    bio: z.string().optional(),
    stats: z
      .object({
        appearances: z.number().int().min(0),
        goals: z.number().int().min(0),
        assists: z.number().int().min(0),
      })
      .optional(),
  }),
});

const sponsors = defineCollection({
  loader: file('src/data/sponsors.yaml'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    tier: z.enum(['main', 'official', 'partner']),
    logo: z.string().startsWith('/images/sponsors/'),
    url: z.url(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: dateOnly('date'),
    category: z.enum(['match-report', 'club', 'transfer', 'academy']),
    excerpt: z.string().min(20).max(200),
    image: z.string().startsWith('/images/news/'),
    // Required, not optional: accessibility must not be droppable by omission.
    imageAlt: z.string().min(1),
    author: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { club, season, teams, fixtures, standings, squad, sponsors, news };
