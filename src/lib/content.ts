import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, getEntry } from 'astro:content';
import type { Match } from './fixtures';
import type { StandingsInput } from './standings';
import type { Player, Position } from './squad';
import { sortSlides, type Slide } from './slides';
import {
  assertNoDuplicateIds,
  assertNoDuplicateNewsIds,
  assertPublicAssetsExist,
  assertReferencesResolve,
  assertUniqueSquadNumbers,
} from './validate';

export const CLUB_SLUG = 'kedah';

// import.meta.url is unreliable here: Astro bundles this module into
// dist/.prerender/chunks/ for prerendering, so a URL relative to the source
// file's location no longer points at public/. process.cwd() is stable
// across `astro dev`, `astro build` and vitest, which all run from the
// project root.
const PUBLIC_DIR = join(process.cwd(), 'public');

export interface Team {
  id: string;
  name: string;
  shortName: string;
  crest: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'main' | 'official' | 'partner';
  logo: string;
  url?: string;
}

export interface Article {
  slug: string;
  title: string;
  date: Date;
  category: 'match-report' | 'club' | 'transfer' | 'academy';
  excerpt: string;
  image: string;
  imageAlt: string;
  author: string;
}

export interface SiteData {
  club: {
    name: string;
    shortName: string;
    founded: number;
    stadium: string;
    stadiumCapacity: number;
    city: string;
    emails: { label: string; address: string }[];
    phone: string;
    socials: { platform: string; url: string }[];
  };
  season: { competition: string; standingsUpdated: Date };
  teams: Team[];
  teamsBySlug: Map<string, Team>;
  matches: Match[];
  standings: StandingsInput[];
  squad: Player[];
  sponsors: Sponsor[];
  slides: Slide[];
  articles: Article[];
}

let cached: Promise<SiteData> | null = null;

/**
 * Loads and validates every collection exactly once per build. Pages must call
 * this rather than getCollection() directly, so the cross-entry validators
 * below cannot be bypassed by adding a new page.
 */
export function loadSiteData(): Promise<SiteData> {
  cached ??= build();
  return cached;
}

/**
 * Every file()-loaded collection in src/content.config.ts points at a YAML
 * file living directly in src/data/, and every one of those files is a YAML
 * array of entries with an "id" field (assertNoDuplicateIds enforces the
 * shape and throws if it isn't). Deriving the list from the directory —
 * rather than hand-listing filenames here — means a newly added data file is
 * covered automatically. A hand-maintained list is exactly how club.yaml and
 * season.yaml went unchecked in an earlier pass: both existed, both matched
 * the pattern, and both were simply missing from the array. The only way
 * this list can go stale again is if a future file()-loaded collection lives
 * outside src/data/ or uses the object-keyed (non-array) form of file() —
 * neither is true of any collection today.
 */
function dataFilesWithIds(): string[] {
  return readdirSync(join(process.cwd(), 'src/data'))
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => `src/data/${name}`)
    .sort();
}

async function build(): Promise<SiteData> {
  // Runs before anything touches getCollection(): Astro's file() loader
  // dedupes by id in its own store before getCollection() returns, so this
  // check must see the raw YAML or it can never catch a duplicate.
  for (const dataFile of dataFilesWithIds()) {
    assertNoDuplicateIds(dataFile);
  }
  // Same reasoning, different loader: glob() (news) dedupes by slugged
  // filename in its own store before getCollection() returns, so this must
  // also run ahead of getCollection('news') to ever see the collision.
  assertNoDuplicateNewsIds(join(process.cwd(), 'src/content/news'));

  const clubEntry = await getEntry('club', 'club');
  const seasonEntry = await getEntry('season', 'current');
  if (!clubEntry) throw new Error('src/data/club.yaml is missing its "club" entry.');
  if (!seasonEntry) throw new Error('src/data/season.yaml is missing its "current" entry.');

  const [
    teamEntries,
    fixtureEntries,
    standingEntries,
    squadEntries,
    sponsorEntries,
    newsEntries,
    slideEntries,
  ] = await Promise.all([
    getCollection('teams'),
    getCollection('fixtures'),
    getCollection('standings'),
    getCollection('squad'),
    getCollection('sponsors'),
    getCollection('news', ({ data }) => import.meta.env.DEV || !data.draft),
    getCollection('slides'),
  ]);

  const teams: Team[] = teamEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    shortName: e.data.shortName,
    crest: e.data.crest,
  }));

  const matches: Match[] = fixtureEntries.map((e) => ({
    id: e.id,
    competition: e.data.competition,
    matchweek: e.data.matchweek,
    date: e.data.date,
    venue: e.data.venue,
    home: e.data.home.id,
    away: e.data.away.id,
    status: e.data.status,
    score: e.data.score,
    report: e.data.report?.id,
    tickets: e.data.tickets,
    stream: e.data.stream,
  }));

  const teamsBySlug = new Map(teams.map((t) => [t.id, t]));

  const standings: StandingsInput[] = standingEntries.map((e) => ({
    team: e.data.team.id,
    name: teamsBySlug.get(e.data.team.id)?.name ?? e.data.team.id,
    won: e.data.won,
    drawn: e.data.drawn,
    lost: e.data.lost,
    goalsFor: e.data.goalsFor,
    goalsAgainst: e.data.goalsAgainst,
  }));

  const squad: Player[] = squadEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    number: e.data.number,
    position: e.data.position as Position,
    nationality: e.data.nationality,
    dateOfBirth: e.data.dateOfBirth,
    heightCm: e.data.heightCm,
    photo: e.data.photo,
    joined: e.data.joined,
    bio: e.data.bio,
    stats: e.data.stats,
  }));

  const sponsors: Sponsor[] = sponsorEntries.map((e) => ({
    id: e.id,
    name: e.data.name,
    tier: e.data.tier,
    logo: e.data.logo,
    url: e.data.url,
  }));

  const slides: Slide[] = sortSlides(
    slideEntries.map((e) => ({
      id: e.id,
      image: e.data.image,
      imageAlt: e.data.imageAlt,
      eyebrow: e.data.eyebrow,
      title: e.data.title,
      href: e.data.href,
      cta: e.data.cta,
      order: e.data.order,
    })),
  );

  const articles: Article[] = newsEntries
    .map((e) => ({
      slug: e.id,
      title: e.data.title,
      date: e.data.date,
      category: e.data.category,
      excerpt: e.data.excerpt,
      image: e.data.image,
      imageAlt: e.data.imageAlt,
      author: e.data.author,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  assertUniqueSquadNumbers(squad);

  // Astro's reference() does not check existence, so do it here — this is the
  // only place that holds every collection at once.
  const teamIds = new Set(teams.map((t) => t.id));
  assertReferencesResolve(
    [
      ...matches.flatMap((m) => [
        { from: m.id, field: 'home', id: m.home },
        { from: m.id, field: 'away', id: m.away },
      ]),
      ...standingEntries.map((e) => ({
        from: e.id,
        field: 'team',
        id: e.data.team.id,
      })),
    ],
    teamIds,
    'teams',
  );

  const articleIds = new Set(articles.map((a) => a.slug));
  assertReferencesResolve(
    matches
      .filter((m) => m.report)
      .map((m) => ({ from: m.id, field: 'report', id: m.report! })),
    articleIds,
    'news',
  );

  assertPublicAssetsExist(
    [
      ...teams.map((t) => t.crest),
      ...squad.map((p) => p.photo),
      ...sponsors.map((s) => s.logo),
      ...articles.map((a) => a.image),
      ...slides.map((s) => s.image),
    ],
    PUBLIC_DIR,
  );

  return {
    club: clubEntry.data,
    season: seasonEntry.data,
    teams,
    teamsBySlug,
    matches,
    standings,
    squad,
    sponsors,
    slides,
    articles,
  };
}
