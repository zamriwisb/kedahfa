import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertNoDuplicateIds,
  assertNoDuplicateNewsIds,
  assertPublicAssetsExist,
  assertReferencesResolve,
  assertTicketLinksAreHomeOnly,
  assertUniqueSquadNumbers,
} from '../../src/lib/validate';

describe('assertUniqueSquadNumbers', () => {
  it('accepts a squad with distinct numbers', () => {
    expect(() =>
      assertUniqueSquadNumbers([
        { id: 'a', number: 1 },
        { id: 'b', number: 9 },
      ]),
    ).not.toThrow();
  });

  it('throws naming both players and the duplicated number', () => {
    expect(() =>
      assertUniqueSquadNumbers([
        { id: 'firdaus-rahman', number: 9 },
        { id: 'samuel-osei', number: 9 },
      ]),
    ).toThrow(/9.*firdaus-rahman.*samuel-osei/s);
  });

  it('accepts an empty squad', () => {
    expect(() => assertUniqueSquadNumbers([])).not.toThrow();
  });
});

describe('assertNoDuplicateIds', () => {
  function yamlFixtureDir(): string {
    return mkdtempSync(join(tmpdir(), 'kedah-dup-ids-'));
  }

  function writeYaml(dir: string, name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }

  it('accepts a file with distinct ids', () => {
    const dir = yamlFixtureDir();
    const path = writeYaml(
      dir,
      'clean.yaml',
      '- id: jdt\n  team: jdt\n- id: kedah\n  team: kedah\n',
    );
    expect(() => assertNoDuplicateIds(path)).not.toThrow();
  });

  it('throws naming the file, the repeated id, and how many times it occurs', () => {
    const dir = yamlFixtureDir();
    const path = writeYaml(
      dir,
      'standings.yaml',
      '- id: jdt\n  team: jdt\n- id: kedah\n  team: kedah\n- id: jdt\n  team: jdt\n',
    );
    expect(() => assertNoDuplicateIds(path)).toThrow(
      new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*jdt.*2 times`, 's'),
    );
  });

  it('names every offending id when several ids are duplicated, not just the first', () => {
    const dir = yamlFixtureDir();
    const path = writeYaml(
      dir,
      'many-dupes.yaml',
      [
        '- id: a',
        '- id: b',
        '- id: a',
        '- id: c',
        '- id: b',
        '- id: b',
      ].join('\n') + '\n',
    );
    expect(() => assertNoDuplicateIds(path)).toThrow(
      /"a" appears 2 times[\s\S]*"b" appears 3 times/,
    );

    // "c" is not duplicated and must not be reported.
    let message = '';
    try {
      assertNoDuplicateIds(path);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/"c"/);
  });

  it('accepts an empty array', () => {
    const dir = yamlFixtureDir();
    const path = writeYaml(dir, 'empty.yaml', '[]\n');
    expect(() => assertNoDuplicateIds(path)).not.toThrow();
  });
});

describe('assertPublicAssetsExist', () => {
  function fixtureDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'kedah-assets-'));
    mkdirSync(join(dir, 'images', 'squad'), { recursive: true });
    writeFileSync(join(dir, 'images', 'squad', 'present.svg'), '<svg/>');
    return dir;
  }

  it('accepts paths that resolve inside the public directory', () => {
    expect(() =>
      assertPublicAssetsExist(['/images/squad/present.svg'], fixtureDir()),
    ).not.toThrow();
  });

  it('throws naming every missing asset', () => {
    expect(() =>
      assertPublicAssetsExist(
        ['/images/squad/present.svg', '/images/squad/gone.svg', '/images/news/also-gone.jpg'],
        fixtureDir(),
      ),
    ).toThrow(/gone\.svg[\s\S]*also-gone\.jpg/);
  });

  it('checks each distinct path once even when repeated', () => {
    expect(() =>
      assertPublicAssetsExist(
        ['/images/squad/gone.svg', '/images/squad/gone.svg'],
        fixtureDir(),
      ),
    ).toThrow(/gone\.svg/);
  });
});

describe('assertReferencesResolve', () => {
  const teams = new Set(['kedah', 'jdt', 'selangor']);

  it('accepts references whose targets all exist', () => {
    expect(() =>
      assertReferencesResolve(
        [
          { from: '2026-08-02-jdt-h', field: 'home', id: 'kedah' },
          { from: '2026-08-02-jdt-h', field: 'away', id: 'jdt' },
        ],
        teams,
        'teams',
      ),
    ).not.toThrow();
  });

  it('throws naming the entry, the field and the missing target', () => {
    expect(() =>
      assertReferencesResolve(
        [{ from: '2026-08-02-jdt-h', field: 'away', id: 'perak' }],
        teams,
        'teams',
      ),
    ).toThrow(/2026-08-02-jdt-h.*away.*perak/s);
  });

  it('reports every broken reference, not only the first', () => {
    expect(() =>
      assertReferencesResolve(
        [
          { from: 'fixture-a', field: 'home', id: 'ghost-one' },
          { from: 'fixture-b', field: 'report', id: 'ghost-two' },
        ],
        teams,
        'teams',
      ),
    ).toThrow(/ghost-one[\s\S]*ghost-two/);
  });

  it('accepts an empty reference list', () => {
    expect(() => assertReferencesResolve([], teams, 'teams')).not.toThrow();
  });
});

describe('assertNoDuplicateNewsIds', () => {
  function newsFixtureDir(): string {
    return mkdtempSync(join(tmpdir(), 'kedah-news-ids-'));
  }

  function writeArticle(dir: string, filename: string): string {
    const path = join(dir, filename);
    writeFileSync(path, '---\ntitle: test\n---\nBody.\n');
    return path;
  }

  it('accepts a directory with no colliding ids', () => {
    const dir = newsFixtureDir();
    writeArticle(dir, 'kedah-edge-selangor.md');
    writeArticle(dir, 'new-signing-announced.md');
    writeArticle(dir, 'academy-trials-open.md');
    expect(() => assertNoDuplicateNewsIds(dir)).not.toThrow();
  });

  it('throws when two filenames collide only by case', () => {
    const dir = newsFixtureDir();
    writeArticle(dir, 'Kedah Edge Selangor.md');
    writeArticle(dir, 'kedah-edge-selangor.md');
    expect(() => assertNoDuplicateNewsIds(dir)).toThrow(
      /"kedah-edge-selangor".*Kedah Edge Selangor\.md.*kedah-edge-selangor\.md/s,
    );
  });

  it('accepts a clean multi-file directory with varied names', () => {
    const dir = newsFixtureDir();
    writeArticle(dir, 'first-team-wins-derby.md');
    writeArticle(dir, 'youth-academy-update.md');
    writeArticle(dir, 'transfer-window-closes.md');
    writeArticle(dir, 'stadium-redevelopment.md');
    expect(() => assertNoDuplicateNewsIds(dir)).not.toThrow();
  });
});

describe('assertTicketLinksAreHomeOnly', () => {
  it('accepts a home fixture carrying both links', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [
          {
            id: '2026-08-29-imigresen-ii-h',
            home: 'kedah',
            tickets: 'https://example.com/tickets',
            stream: 'https://example.com/ppv',
          },
        ],
        'kedah',
      ),
    ).not.toThrow();
  });

  it('accepts an away fixture carrying neither', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly([{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii' }], 'kedah'),
    ).not.toThrow();
  });

  it('throws naming the fixture and the tickets field for an away fixture', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii', tickets: '/tickets' }],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: tickets/);
  });

  it('throws naming the stream field for an away fixture', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [{ id: '2026-09-06-ns-a', home: 'negeri-sembilan-ii', stream: '/watch' }],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: stream/);
  });

  it('names both fields when an away fixture carries both', () => {
    expect(() =>
      assertTicketLinksAreHomeOnly(
        [
          {
            id: '2026-09-06-ns-a',
            home: 'negeri-sembilan-ii',
            tickets: '/tickets',
            stream: '/watch',
          },
        ],
        'kedah',
      ),
    ).toThrow(/2026-09-06-ns-a: tickets, stream/);
  });

  it('accepts an empty schedule', () => {
    expect(() => assertTicketLinksAreHomeOnly([], 'kedah')).not.toThrow();
  });
});
