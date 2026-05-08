"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsService = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const prisma_1 = require("../../config/prisma");
const io_1 = require("../../sockets/io");
const pagination_1 = require("../../utils/pagination");
const shared_1 = require("../shared");
const notifications_service_1 = require("../notifications/notifications.service");
class PostsService {
    /** Creates a post or reply with sanitization and idempotency support. */
    async createPost(userId, input) {
        const content = (0, sanitize_html_1.default)(input.content ?? '', { allowedTags: [], allowedAttributes: {} }).trim();
        const mediaUrls = (input.mediaUrls ?? []).filter((mediaUrl) => Boolean(mediaUrl?.trim()));
        const mood = (0, sanitize_html_1.default)(input.mood ?? '', { allowedTags: [], allowedAttributes: {} }).trim() || null;
        const pollQuestion = (0, sanitize_html_1.default)(input.poll?.question ?? '', { allowedTags: [], allowedAttributes: {} }).trim() || null;
        const pollOptions = (input.poll?.options ?? [])
            .map((option) => (0, sanitize_html_1.default)(option, { allowedTags: [], allowedAttributes: {} }).trim())
            .filter(Boolean);
        if (!content && mediaUrls.length === 0 && !mood && !pollQuestion && pollOptions.length === 0) {
            throw new Error('Post content, media, mood or poll data is required');
        }
        const postType = pollQuestion && pollOptions.length >= 2
            ? 'POLL'
            : mood
                ? 'MOOD'
                : mediaUrls.length > 0
                    ? 'IMAGE'
                    : 'TEXT';
        const existing = input.idempotencyKey
            ? await prisma_1.prisma.auditLog.findFirst({ where: { action: `post:${input.idempotencyKey}`, userId } })
            : null;
        if (existing) {
            const post = await prisma_1.prisma.post.findFirst({ where: { authorId: userId, content }, orderBy: { createdAt: 'desc' } });
            if (post) {
                return prisma_1.prisma.post.findUnique({
                    where: { id: post.id },
                    include: {
                        author: { select: shared_1.publicUserSelect },
                        _count: { select: { comments: true, likes: true, reposts: true } }
                    }
                });
            }
        }
        const post = await prisma_1.prisma.post.create({
            data: {
                authorId: userId,
                content,
                mediaUrls,
                postType,
                mood,
                pollQuestion,
                pollOptions,
                parentId: input.parentId ?? null
            }
        });
        const createdPost = await prisma_1.prisma.post.findUnique({
            where: { id: post.id },
            include: {
                author: { select: shared_1.publicUserSelect },
                _count: { select: { comments: true, likes: true, reposts: true } }
            }
        });
        // ✅ Emit real-time event for new post - broadcasts to all connected clients through Redis
        // With Redis adapter, this propagates across all backend replicas automatically
        if (createdPost) {
            const io = (0, io_1.getSocketServer)();
            if (io) {
                // Emit to all clients in the 'feed' room
                io.to('feed').emit('new_post', createdPost);
                // Also emit to explore room
                io.to('explore').emit('new_post', createdPost);
            }
        }
        return createdPost;
    }
    /**
     * Returns the authenticated user's home feed.
     * ✅ FIX: now includes public posts from non-followed accounts so the feed
     * isn't empty for new users; also enriches each post with isLiked/isReposted.
     */
    async feed(userId, cursor, limitInput) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const posts = await prisma_1.prisma.post.findMany({
            where: {
                deletedAt: null,
                OR: [
                    // Own posts
                    { authorId: userId },
                    // Accepted follows — any audience
                    { author: { followers: { some: { followerId: userId, status: 'ACCEPTED' } } } },
                    // Public posts from accounts not yet followed (discovery)
                    { audience: 'PUBLIC' }
                ]
            },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: shared_1.publicUserSelect },
                _count: { select: { comments: true, likes: true, reposts: true } }
            }
        });
        const hasMore = posts.length > limit;
        const pageItems = hasMore ? posts.slice(0, limit) : posts;
        const enriched = await this.enrichWithLikeStatus(pageItems, userId);
        return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Returns public trending posts (no viewer enrichment needed for explore). */
    async explore(cursor, limitInput, viewerId) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const posts = await prisma_1.prisma.post.findMany({
            where: { deletedAt: null, audience: 'PUBLIC' },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
            include: {
                author: { select: shared_1.publicUserSelect },
                _count: { select: { comments: true, likes: true, reposts: true } }
            }
        });
        const hasMore = posts.length > limit;
        const pageItems = hasMore ? posts.slice(0, limit) : posts;
        const enriched = viewerId ? await this.enrichWithLikeStatus(pageItems, viewerId) : pageItems;
        return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /** Returns a single post with its reply thread. */
    async getById(postId, viewerId) {
        const post = await prisma_1.prisma.post.findFirst({
            where: { id: postId, deletedAt: null },
            include: {
                author: { select: shared_1.publicUserSelect },
                comments: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                    include: { author: { select: shared_1.publicUserSelect } }
                },
                replies: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                    include: { author: { select: shared_1.publicUserSelect } }
                },
                _count: { select: { comments: true, likes: true, reposts: true } }
            }
        });
        if (!post)
            throw new Error('Post not found');
        if (viewerId) {
            const [likeRow, repostRow] = await Promise.all([
                prisma_1.prisma.like.findUnique({ where: { userId_postId: { userId: viewerId, postId } } }),
                prisma_1.prisma.repost.findUnique({ where: { userId_postId: { userId: viewerId, postId } } })
            ]);
            return { ...post, isLiked: Boolean(likeRow), isReposted: Boolean(repostRow), viewerId };
        }
        return { ...post, isLiked: false, isReposted: false, viewerId: null };
    }
    /** Soft deletes the given post if the caller owns it. */
    async softDelete(postId, userId) {
        const post = await prisma_1.prisma.post.findFirst({ where: { id: postId, authorId: userId, deletedAt: null } });
        if (!post)
            throw new Error('Post not found');
        await prisma_1.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    }
    /** Toggles a like on the post and returns the new state. */
    async toggleLike(postId, userId) {
        const existing = await prisma_1.prisma.like.findUnique({ where: { userId_postId: { userId, postId } } });
        const io = (0, io_1.getSocketServer)();
        if (existing) {
            await prisma_1.prisma.like.delete({ where: { userId_postId: { userId, postId } } });
            const post = await prisma_1.prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
            // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
            if (io) {
                io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
                io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
            }
            return { liked: false, likesCount: post.likesCount };
        }
        await prisma_1.prisma.like.create({ data: { userId, postId } });
        const post = await prisma_1.prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
        // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
        if (io) {
            io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
            io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
        }
        if (post.authorId !== userId) {
            await notifications_service_1.NotificationsService.createAndEmit({
                recipientId: post.authorId, actorId: userId,
                type: 'LIKE', entityType: 'POST', entityId: postId
            });
        }
        return { liked: true, likesCount: post.likesCount };
    }
    /** Toggles a repost on the post and returns the new state. */
    async toggleRepost(postId, userId) {
        const existing = await prisma_1.prisma.repost.findUnique({ where: { userId_postId: { userId, postId } } });
        const io = (0, io_1.getSocketServer)();
        if (existing) {
            await prisma_1.prisma.repost.delete({ where: { userId_postId: { userId, postId } } });
            const post = await prisma_1.prisma.post.update({ where: { id: postId }, data: { repostsCount: { decrement: 1 } } });
            // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
            if (io) {
                io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
                io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
            }
            return { reposted: false, repostsCount: post.repostsCount };
        }
        await prisma_1.prisma.repost.create({ data: { userId, postId } });
        const post = await prisma_1.prisma.post.update({ where: { id: postId }, data: { repostsCount: { increment: 1 } } });
        // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
        if (io) {
            io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
            io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
        }
        if (post.authorId !== userId) {
            await notifications_service_1.NotificationsService.createAndEmit({
                recipientId: post.authorId, actorId: userId,
                type: 'REPOST', entityType: 'POST', entityId: postId
            });
        }
        return { reposted: true, repostsCount: post.repostsCount };
    }
    /** Lists users who liked a post. */
    async listLikes(postId, cursor, limitInput) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const likes = await prisma_1.prisma.like.findMany({
            where: { postId },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: { user: { select: shared_1.publicUserSelect } }
        });
        const hasMore = likes.length > limit;
        const pageItems = hasMore ? likes.slice(0, limit) : likes;
        return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /**
     * Returns all visible posts by a username, respecting private account settings.
     * ✅ IMPROVED: Now properly handles private accounts
     * - Private users: only followers (accepted) can see posts
     * - Public users: non-followers only see PUBLIC posts, followers see PUBLIC + FOLLOWERS_ONLY
     */
    async postsByUser(username, cursor, limitInput, viewerId) {
        const limit = (0, pagination_1.parseLimit)(limitInput, 20, 50);
        const user = await prisma_1.prisma.user.findFirst({ where: { username: username.toLowerCase(), deletedAt: null } });
        if (!user)
            throw new Error('User not found');
        const isSelfViewing = viewerId === user.id;
        const isFollower = viewerId && !isSelfViewing
            ? await prisma_1.prisma.follow.findFirst({
                where: {
                    followerId: viewerId,
                    followingId: user.id,
                    status: 'ACCEPTED'
                }
            })
            : null;
        // If user is private and viewer is not self and not a follower, return empty
        if (user.isPrivate && !isSelfViewing && !isFollower) {
            return { items: [], pagination: { nextCursor: null, hasMore: false } };
        }
        const posts = await prisma_1.prisma.post.findMany({
            where: {
                authorId: user.id,
                deletedAt: null,
                OR: isSelfViewing || isFollower
                    ? [
                        { audience: 'PUBLIC' },
                        { audience: 'FOLLOWERS_ONLY' }
                    ]
                    : [
                        { audience: 'PUBLIC' }
                    ]
            },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: shared_1.publicUserSelect },
                _count: { select: { comments: true, likes: true, reposts: true } }
            }
        });
        const hasMore = posts.length > limit;
        const pageItems = hasMore ? posts.slice(0, limit) : posts;
        const enriched = viewerId ? await this.enrichWithLikeStatus(pageItems, viewerId) : pageItems;
        return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
    }
    /**
     * ✅ NEW HELPER: Enriches a list of posts with isLiked / isReposted for a viewer.
     * Uses two bulk queries instead of N+1 per-post queries.
     */
    async enrichWithLikeStatus(posts, viewerId) {
        if (posts.length === 0)
            return posts.map((p) => ({ ...p, isLiked: false, isReposted: false }));
        const ids = posts.map((p) => p.id);
        const [likes, reposts] = await Promise.all([
            prisma_1.prisma.like.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
            prisma_1.prisma.repost.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } })
        ]);
        const likedIds = new Set(likes.map((l) => l.postId));
        const repostedIds = new Set(reposts.map((r) => r.postId));
        return posts.map((p) => ({
            ...p,
            isLiked: likedIds.has(p.id),
            isReposted: repostedIds.has(p.id)
        }));
    }
}
exports.PostsService = PostsService;
