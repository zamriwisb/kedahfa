import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// js-yaml@5 ships only named ESM exports (no default export) — a default
// import resolves to undefined under Vite/Vitest's native ESM handling.
import { load } from 'js-yaml';

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
