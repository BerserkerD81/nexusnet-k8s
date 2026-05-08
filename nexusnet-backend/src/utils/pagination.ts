export type CursorPageOptions = {
  limit?: number;
  cursor?: string | null;
};

export function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export function buildCursorPagination<T extends { id: string }>(items: T[], limit: number): { nextCursor: string | null; hasMore: boolean } {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = pageItems.at(-1) ?? null;
  return {
    nextCursor: hasMore && lastItem ? lastItem.id : null,
    hasMore
  };
}
