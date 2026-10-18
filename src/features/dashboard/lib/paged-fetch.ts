/**
 * Small, I/O-agnostic loops for reading past PostgREST's per-request row cap
 * (~1000). The caller supplies the actual query as a function, so these are
 * unit-testable with a fake fetcher. Fetchers should throw on error.
 */

export const PAGE_SIZE = 1000;
export const ID_BATCH_SIZE = 200;

/**
 * Calls `fetchPage(from, to)` (inclusive offsets, as `.range()` takes them)
 * page by page until a page comes back shorter than `pageSize`. The query
 * must have a deterministic order or rows can repeat/skip between pages.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** Runs `fetchBatch` over `ids` in chunks of `batchSize` (keeps `.in()` URLs short), concatenating results. */
export async function fetchInBatches<K, T>(
  ids: readonly K[],
  fetchBatch: (batch: K[]) => Promise<T[]>,
  batchSize = ID_BATCH_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    rows.push(...(await fetchBatch(ids.slice(i, i + batchSize))));
  }
  return rows;
}
