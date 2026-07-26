import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

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
    standingsUpdated: z.coerce.date(),
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
  loader: file('src/data/fixtures.yaml'),
  schema: z
    .object({
      id: z.string(),
      competition: z.string(),
      matchweek: z.number().int().positive().optional(),
      date: z.coerce.date(),
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
    dateOfBirth: z.coerce.date(),
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
    date: z.coerce.date(),
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
