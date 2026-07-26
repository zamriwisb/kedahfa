export const NEWS_PAGE_SIZE = 12;

export interface PageSlice<T> {
  items: T[];
  currentPage: number;
  lastPage: number;
}

/** Always at least 1, so /news renders an empty state rather than 404ing. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function paginate<T>(all: T[], page: number, pageSize: number): PageSlice<T> {
  const lastPage = pageCount(all.length, pageSize);
  const currentPage = Math.min(Math.max(page, 1), lastPage);
  const start = (currentPage - 1) * pageSize;

  return { items: all.slice(start, start + pageSize), currentPage, lastPage };
}
