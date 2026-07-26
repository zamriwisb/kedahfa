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
// carrying a time-of-day, or an ambiguous format, is a content error rather
// than a legitimate value.
//
// These fields are parsed by Astro's own YAML/frontmatter parsing (the
// file() loader for squad.yaml/season.yaml, @astrojs/internal-helpers'
// frontmatter parser for news .md files) — both resolve on the js-yaml v4
// nested under node_modules/astro, NOT the js-yaml v5 this project depends
// on directly (see parseFixturesYaml above). js-yaml v4's default schema
// auto-resolves a YAML-timestamp-shaped scalar to a `Date` before this
// schema ever runs, but only recognises ISO-ish forms: a genuine
// "2026-07-19" arrives as a `Date` at UTC midnight, while anything js-yaml
// doesn't recognise as a timestamp — "11/03/1995", "March 11 1995" — is left
// as a plain string. That string then used to reach z.coerce.date(), i.e.
// `new Date(string)`, whose parsing of non-ISO formats is locale/engine
// dependent and, critically, is NOT anchored to UTC the way ISO date-only
// strings are — so under TZ=UTC, `new Date("11/03/1995")` lands on exactly
// UTC midnight and slipped past the old post-coercion midnight check.
// Verified empirically (see tests/unit/dates.test.ts and
// tests/unit/build-negative.test.ts): "11/03/1995" builds clean and renders
// "3 November 1995" under TZ=UTC, but is correctly rejected under
// TZ=Asia/Kuala_Lumpur — the guard was silently absent on exactly the
// timezone CI and Cloudflare build under.
//
// The fix validates the RAW value's shape instead of trusting whatever
// z.coerce.date() makes of it:
//   - a string must match ^\d{4}-\d{2}-\d{2}$ exactly (so it's unambiguous
//     regardless of parsing engine or locale) and is then anchored to UTC
//     midnight explicitly;
//   - a Date (already resolved by js-yaml) must already be UTC midnight,
//     exactly as before;
//   - anything else — including a Date with a time component, e.g. from
//     "2026-07-19T23:30:00" — is rejected.
// One shared helper for all three fields (news `date`, squad
// `dateOfBirth`, season `standingsUpdated`) so they cannot drift apart.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function dateOnly(fieldLabel: string) {
  const message = `${fieldLabel} must be a plain date with no time component, e.g. "2026-07-19".`;
  return z.any().transform((value, ctx) => {
    if (typeof value === 'string') {
      if (DATE_ONLY_PATTERN.test(value)) {
        return new Date(`${value}T00:00:00.000Z`);
      }
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    if (value instanceof Date && isUtcMidnight(value)) {
      return value;
    }
    ctx.addIssue({ code: 'custom', message });
    return z.NEVER;
  });
}

// Every collection here is file()- or glob()-loaded, and in both loaders the
// object handed to the schema is exactly the raw parsed entry — Astro does
// not merge in "id" or any other key of its own before schema.safeParseAsync
// runs (verified against astro/dist/content/loaders/file.js's `parseData({
// id, data: rawItem, filePath })` and astro/dist/content/content-layer.js's
// `unvalidatedData: data`, both of which keep `id` a sibling argument, never
// spliced into `data`). So .strict() is safe everywhere a schema already
// lists every key the source file legitimately sets — it exists purely to
// turn a mis-keyed field (e.g. "Draft: true" instead of "draft: true") into
// a build failure instead of a silently-dropped, unfinished article
// publishing.
const club = defineCollection({
  loader: file('src/data/club.yaml'),
  schema: z
    .object({
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
    })
    .strict(),
});

const season = defineCollection({
  loader: file('src/data/season.yaml'),
  schema: z
    .object({
      id: z.literal('current'),
      competition: z.string(),
      standingsUpdated: dateOnly('standingsUpdated'),
    })
    .strict(),
});

const teams = defineCollection({
  loader: file('src/data/teams.yaml'),
  schema: z
    .object({
      id: z.string(),
      name: z.string(),
      shortName: z.string().max(4),
      crest: z.string().startsWith('/images/teams/'),
    })
    .strict(),
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
    .strict()
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
    .strict()
    .refine((row) => row.id === row.team.id, {
      message: 'A standings row id must equal its team slug.',
      path: ['id'],
    }),
});

const squad = defineCollection({
  loader: file('src/data/squad.yaml'),
  schema: z
    .object({
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
    })
    .strict(),
});

const sponsors = defineCollection({
  loader: file('src/data/sponsors.yaml'),
  schema: z
    .object({
      id: z.string(),
      name: z.string(),
      tier: z.enum(['main', 'official', 'partner']),
      logo: z.string().startsWith('/images/sponsors/'),
      url: z.url(),
    })
    .strict(),
});

const slides = defineCollection({
  loader: file('src/data/slides.yaml'),
  schema: z
    .object({
      id: z.string(),
      // Deliberately "/images/" and not "/images/slides/": the seed slides
      // point at the shared placeholder in /images/news/ until real
      // photography arrives, and a slide may legitimately reuse a news photo.
      // assertPublicAssetsExist() is what actually guarantees the file is
      // there, so this prefix only rules out off-site and relative URLs.
      image: z.string().startsWith('/images/'),
      // Required, not optional: accessibility must not be droppable by omission.
      imageAlt: z.string().min(1),
      eyebrow: z.string().optional(),
      title: z.string().min(1),
      // A slide's href is either site-relative or an explicit https:// URL —
      // club promotions legitimately point at ticketing partners. The two
      // rejected forms both leave the site while passing a naive
      // startsWith('/') check: "//example.com" is protocol-relative, and a
      // browser normalises the backslash in "/\example.com" into the
      // authority position.
      href: z
        .string()
        .refine(
          (value) =>
            (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) ||
            value.startsWith('https://'),
          {
            message:
              'A slide href must be a site-relative path like "/news/slug" or an absolute https:// URL.',
          },
        )
        .optional(),
      cta: z.string().optional(),
      order: z.number().int().optional(),
    })
    .strict()
    .refine((slide) => slide.cta === undefined || slide.href !== undefined, {
      message: 'A slide with a "cta" label also needs an "href" for the button to link to.',
      path: ['cta'],
    }),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z
    .object({
      title: z.string(),
      date: dateOnly('date'),
      category: z.enum(['match-report', 'club', 'transfer', 'academy']),
      excerpt: z.string().min(20).max(200),
      image: z.string().startsWith('/images/news/'),
      // Required, not optional: accessibility must not be droppable by omission.
      imageAlt: z.string().min(1),
      author: z.string(),
      draft: z.boolean().default(false),
    })
    .strict(),
});

export const collections = { club, season, teams, fixtures, standings, squad, slides, sponsors, news };
