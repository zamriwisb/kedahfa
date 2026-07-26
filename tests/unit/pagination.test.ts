import { describe, expect, it } from 'vitest';
import { NEWS_PAGE_SIZE, pageCount, paginate } from '../../src/lib/pagination';

const items = Array.from({ length: 25 }, (_, i) => i + 1);

describe('pageCount', () => {
  it('counts a partial final page', () => {
    expect(pageCount(25, 12)).toBe(3);
  });

  it('counts an exact multiple without adding an empty page', () => {
    expect(pageCount(24, 12)).toBe(2);
  });

  it('reports one page when there is nothing to show, so /news still exists', () => {
    expect(pageCount(0, 12)).toBe(1);
  });
});

describe('paginate', () => {
  it('returns the first slice', () => {
    const slice = paginate(items, 1, 12);
    expect(slice.items).toHaveLength(12);
    expect(slice.items[0]).toBe(1);
    expect(slice.currentPage).toBe(1);
    expect(slice.lastPage).toBe(3);
  });

  it('returns a middle slice', () => {
    expect(paginate(items, 2, 12).items[0]).toBe(13);
  });

  it('returns the short final slice', () => {
    expect(paginate(items, 3, 12).items).toEqual([25]);
  });

  it('clamps a page below the first', () => {
    expect(paginate(items, 0, 12).currentPage).toBe(1);
  });

  it('clamps a page beyond the last', () => {
    expect(paginate(items, 99, 12).currentPage).toBe(3);
  });

  it('handles an empty list without throwing', () => {
    expect(paginate([], 1, 12)).toEqual({ items: [], currentPage: 1, lastPage: 1 });
  });
});

describe('NEWS_PAGE_SIZE', () => {
  it('matches the spec of twelve articles per page', () => {
    expect(NEWS_PAGE_SIZE).toBe(12);
  });
});
