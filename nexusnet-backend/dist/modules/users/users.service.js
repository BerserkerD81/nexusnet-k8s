"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const redis_1 = require("../../config/redis");
const prisma_1 = require("../../config/prisma");
const shared_1 = require("../shared");
const pagination_1 = require("../../utils/pagination");
class UsersService {
    /**
     * Returns the authenticated user's profile.
     * ✅ FIX: include _count so followersCount / followingCount / postsCount are
     * populated in the frontend instead of always showing 0.
     */
    async getMe(userId) {
        const profile = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                ...shared_1.publicUserSelect,
                _count: {
                    select: { followers: true, following: true, posts: true }
                }
            }
        });
        if (!profile)
            throw new Error('User not found');
        return profile;
    }
    /** Updates the current user's public profile. */
    async updateMe(userId, input) {
        const profile = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                displayName: input.displayName
                    ? (0, sanitize_html_1.default)(input.displayName, { allowedTags: [], allowedAttributes: {} })
                    : undefined,
                bio: input.bio === undefined
                    ? undefined
                    : input.bio
                        ? (0, sanitize_html_1.default)(input.bio, { allowedTags: [], allowedAttributes: {} })
                        : null,
                avatarUrl: input.avatarUrl ?? undefined,
                bannerUrl: input.bannerUrl ?? undefined,
                isPrivate: input.isPrivate
            },
            select: {
                ...shared_1.publicUserSelect,
                _count: { select: { followers: true, following: true, posts: true } }
            }
        });
        return profile;
    }
    /** Searches users by username or display name with cursor pagination. */
    async search(query, cursor, limitInput) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const users = await prisma_1.prisma.user.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { displayName: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: shared_1.publicUserSelect,
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' }
        });
        const hasMore = users.length > limit;
        const pageItems = hasMore ? users.slice(0, limit) : users;
        return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /**
     * Returns a public profile and follows relationship summary.
     * ✅ includes isFollowing flag so the frontend can show the correct button state.
     */
    async getByUsername(username, viewerId) {
        const user = await prisma_1.prisma.user.findFirst({
            where: { username: username.toLowerCase(), deletedAt: null },
            select: {
                ...shared_1.publicUserSelect,
                followers: {
                    where: viewerId ? { followerId: viewerId } : { followerId: '' },
                    select: { status: true }
                },
                _count: {
                    select: { followers: true, following: true, posts: true }
                }
            }
        });
        if (!user)
            throw new Error('User not found');
        const followStatus = user.followers[0]?.status ?? null;
        return {
            ...user,
            isFollowing: followStatus === 'ACCEPTED',
            isPending: followStatus === 'PENDING'
        };
    }
    /**
     * Checks if a user is currently online by looking up their presence in Redis.
     * Returns { isOnline: boolean, lastSeen?: timestamp }
     */
    async isUserOnline(userId) {
        const presenceCount = await redis_1.redis.scard(`presence:${userId}`);
        return {
            isOnline: presenceCount > 0,
            userId,
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Batch check which users from a list are online.
     * Useful for showing status indicators in conversations or user lists.
     */
    async checkUsersOnline(userIds) {
        if (!userIds.length)
            return [];
        const presences = await Promise.all(userIds.map(id => redis_1.redis.scard(`presence:${id}`)));
        return userIds.map((userId, index) => ({
            userId,
            isOnline: presences[index] > 0,
            timestamp: new Date().toISOString()
        }));
    }
}
exports.UsersService = UsersService;
