import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Invariants that span multiple entries. Zod validates one record at a time,
 * so uniqueness and asset existence cannot live in the collection schemas.
 * Every function throws — called from loadSiteData(), a throw fails the build.
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

export function assertUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }

  if (duplicates.size === 0) return;
  throw new Error(`Duplicate ${label} entries: ${[...duplicates].join(', ')}`);
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
