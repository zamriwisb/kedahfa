import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
// js-yaml@5 ships only named ESM exports (no default export) — a default
// import resolves to undefined under Vite/Vitest's native ESM handling.
import { load } from 'js-yaml';
// Astro's glob() loader (src/content.config.ts's news collection) derives an
// entry's id by running each path segment of the filename (sans extension)
// through github-slugger's slug() — see astro/dist/content/utils.js's
// getContentEntryIdAndSlug, which the loader calls when no frontmatter
// "slug" is set (astro/dist/content/loaders/glob.js's generateIdDefault).
// Importing the same function Astro uses, rather than reimplementing
// slugification, is what keeps this check's ids identical to Astro's —
// verified against the three real articles in src/content/news/: this
// produces "academy-trials-open", "kedah-edge-selangor" and
// "new-signing-announced", exactly the routes `astro build` emits.
import { slug as githubSlug } from 'github-slugger';

/**
 * Invariants that span multiple entries. Zod validates one record at a time,
 * so uniqueness and asset existence cannot live in the collection schemas.
 * Every function throws — called from loadSiteData(), a throw fails the build.
 *
 * No astro:content or .astro imports here: this module is unit-tested with
 * plain Vitest, outside Astro's content pipeline.
 */

export function assertUniqueSquadNumbers(players: { id: string; number: number }[]): void {
  const byNumber = new Map<number, string[]>();
  for (const player of players) {
    byNumber.set(player.number, [...(byNumber.get(player.number) ?? []), player.id]);
  }

  const clashes = [...byNumber.entries()].filter(([, ids]) => ids.length > 1);
  if (clashes.length === 0) return;

  const detail = clashes
    .map(([number, ids]) => `  ${number}: ${ids.join(', ')}`)
    .join('\n');
  throw new Error(`Duplicate squad numbers in src/data/squad.yaml:\n${detail}`);
}

/**
 * Astro's file() loader dedupes entries by id in its own store BEFORE
 * getCollection() ever returns (it logs a warning and lets the later entry
 * silently overwrite the earlier one — see astro/dist/content/loaders/file.js).
 * A check that runs on the loaded collection can therefore never observe a
 * duplicate. This reads and parses the YAML file directly — ahead of that
 * dedup — so a repeated id actually fails the build instead of silently
 * dropping or overwriting an entry.
 */
export function assertNoDuplicateIds(filePath: string): void {
  const raw = readFileSync(filePath, 'utf-8');
  const data = load(raw);
  if (!Array.isArray(data)) {
    throw new Error(`${filePath} must contain a YAML array of entries with an "id" field.`);
  }

  const counts = new Map<string, number>();
  for (const entry of data) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length === 0) return;

  const detail = duplicates
    .map(([id, count]) => `  "${id}" appears ${count} times`)
    .join('\n');
  throw new Error(`Duplicate ids in ${filePath}:\n${detail}`);
}

/**
 * Astro's glob() loader (the news collection) derives each entry's id by
 * slugging the filename with github-slugger — and, like the file() loader's
 * duplicate-id handling that assertNoDuplicateIds guards against, it dedupes
 * silently: it logs "Duplicate id ... Later items will overwrite earlier
 * ones" and lets the later file win, with no non-zero exit. Two filenames
 * that differ only in case or spacing — "Kedah Edge Selangor.md" and
 * "kedah-edge-selangor.md" — both slug to "kedah-edge-selangor", so the
 * collision is invisible to anything that only looks at the (already
 * deduped) loaded collection. This reads the news directory directly, ahead
 * of that dedup, so a collision fails the build instead of nondeterministically
 * picking a winner.
 */
export function assertNoDuplicateNewsIds(newsDir: string): void {
  const files = readdirSync(newsDir).filter((name) => extname(name).toLowerCase() === '.md');

  const byId = new Map<string, string[]>();
  for (const file of files) {
    const id = githubSlug(file.slice(0, -extname(file).length));
    byId.set(id, [...(byId.get(id) ?? []), file]);
  }

  const collisions = [...byId.entries()].filter(([, files]) => files.length > 1);
  if (collisions.length === 0) return;

  const detail = collisions
    .map(([id, files]) => `  "${id}" ← ${files.join(', ')}`)
    .join('\n');
  throw new Error(
    `Colliding news article ids in ${newsDir}:\n${detail}\n` +
      `These filenames slug to the same id, so Astro's glob() loader silently ` +
      `lets one overwrite the other — rename the files so their slugs are distinct.`,
  );
}

export function assertPublicAssetsExist(paths: string[], publicDir: string): void {
  const missing = [...new Set(paths)].filter(
    (path) => !existsSync(join(publicDir, path.replace(/^\//, ''))),
  );

  if (missing.length === 0) return;
  throw new Error(
    `Referenced files are missing from public/:\n${missing.map((p) => `  ${p}`).join('\n')}`,
  );
}

export interface Reference {
  /** The id of the entry holding the reference, for the error message. */
  from: string;
  /** The field name holding the reference, e.g. "home" or "report". */
  field: string;
  /** The id being referenced. */
  id: string;
}

/**
 * Astro's reference() supplies typing and transforms a slug into
 * { collection, id }, but does NOT verify the target exists — a fixture naming
 * a team absent from teams.yaml builds clean. Verified against Astro 7.1.3.
 * This is the check that actually enforces referential integrity.
 */
export function assertReferencesResolve(
  refs: Reference[],
  knownIds: Set<string>,
  label: string,
): void {
  const broken = refs.filter((ref) => !knownIds.has(ref.id));
  if (broken.length === 0) return;

  const detail = broken
    .map((ref) => `  ${ref.from} → ${ref.field}: "${ref.id}"`)
    .join('\n');
  throw new Error(
    `References to unknown ${label} entries:\n${detail}\n` +
      `Known ${label}: ${[...knownIds].sort().join(', ')}`,
  );
}
