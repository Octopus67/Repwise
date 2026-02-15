/**
 * Pagination Utility
 */

/**
 * Determine if there are more pages to fetch.
 */
export function hasMorePages(totalCount: number, currentPage: number, pageSize: number): boolean {
  return currentPage * pageSize < totalCount;
}
