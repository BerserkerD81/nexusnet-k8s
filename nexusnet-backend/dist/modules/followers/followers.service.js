"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowersService = void 0;
const prisma_1 = require("../../config/prisma");
const pagination_1 = require("../../utils/pagination");
const shared_1 = require("../shared");
const notifications_service_1 = require("../notifications/notifications.service");
class FollowersService {
    /** Creates a follow relationship, respecting private account requests. */
    async follow(followerId, followingId) {
        if (followerId === followingId) {
            const error = new Error('You cannot follow yourself');
            error.status = 400;
            throw error;
        }
        const target = await prisma_1.prisma.user.findUnique({ where: { id: followingId } });
        if (!target) {
            throw new Error('User not found');
        }
        const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';
        const relation = await prisma_1.prisma.follow.upsert({
            where: { followerId_followingId: { followerId, followingId } },
            update: { status },
            create: { followerId, followingId, status }
        });
        if (followerId !== followingId) {
            await notifications_service_1.NotificationsService.createAndEmit({
                recipientId: followingId, actorId: followerId,
                type: 'FOLLOW', entityType: 'FOLLOW', entityId: relation.id
            });
        }
        return relation;
    }
    /** Removes a follow relationship. */
    async unfollow(followerId, followingId) {
        await prisma_1.prisma.follow.deleteMany({ where: { followerId, followingId } });
    }
    /** Accepts or rejects a pending follow request on a private account. */
    async respondToRequest(userId, followerId, accepted) {
        const follow = await prisma_1.prisma.follow.findFirst({ where: { followingId: userId, followerId, status: 'PENDING' } });
        if (!follow) {
            throw new Error('Follow request not found');
        }
        if (!accepted) {
            await prisma_1.prisma.follow.delete({ where: { id: follow.id } });
            return { accepted: false };
        }
        return prisma_1.prisma.follow.update({ where: { id: follow.id }, data: { status: 'ACCEPTED' } });
    }
    /** Lists followers with cursor pagination. */
    async listFollowers(userId, cursor, limitInput) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const relations = await prisma_1.prisma.follow.findMany({
            where: { followingId: userId, status: 'ACCEPTED' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: { follower: { select: shared_1.publicUserSelect } }
        });
        const hasMore = relations.length > limit;
        const pageItems = hasMore ? relations.slice(0, limit) : relations;
        return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Lists following accounts with cursor pagination. */
    async listFollowing(userId, cursor, limitInput) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const relations = await prisma_1.prisma.follow.findMany({
            where: { followerId: userId, status: 'ACCEPTED' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: { following: { select: shared_1.publicUserSelect } }
        });
        const hasMore = relations.length > limit;
        const pageItems = hasMore ? relations.slice(0, limit) : relations;
        return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Suggests accounts to follow based on mutual edges. */
    async suggestions(userId) {
        const suggestions = await prisma_1.prisma.user.findMany({
            where: {
                deletedAt: null,
                id: { not: userId },
                following: { none: { followerId: userId } }
            },
            select: shared_1.publicUserSelect,
            take: 10,
            orderBy: { createdAt: 'desc' }
        });
        return suggestions;
    }
}
exports.FollowersService = FollowersService;
