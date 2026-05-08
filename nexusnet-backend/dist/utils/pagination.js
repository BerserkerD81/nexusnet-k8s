"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLimit = parseLimit;
exports.buildCursorPagination = buildCursorPagination;
function parseLimit(value, fallback = 20, max = 50) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(parsed), max);
}
function buildCursorPagination(items, limit) {
    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const lastItem = pageItems.at(-1) ?? null;
    return {
        nextCursor: hasMore && lastItem ? lastItem.id : null,
        hasMore
    };
}
