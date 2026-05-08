import sanitizeHtml from 'sanitize-html';
import { prisma } from '@config/prisma';
import { getSocketServer } from '@sockets/io';
import { parseLimit } from '@utils/pagination';
import { publicUserSelect } from '@modules/shared';
import { NotificationsService } from '@modules/notifications/notifications.service';

export class PostsService {
  /** Creates a post or reply with sanitization and idempotency support. */
  async createPost(userId: string, input: {
    content?: string;
    mediaUrls?: string[];
    mood?: string | null;
    poll?: {
      question: string;
      options: string[];
    } | null;
    parentId?: string | null;
    idempotencyKey?: string;
  }) {
    const content = sanitizeHtml(input.content ?? '', { allowedTags: [], allowedAttributes: {} }).trim();
    const mediaUrls = (input.mediaUrls ?? []).filter((mediaUrl) => Boolean(mediaUrl?.trim()));
    const mood = sanitizeHtml(input.mood ?? '', { allowedTags: [], allowedAttributes: {} }).trim() || null;
    const pollQuestion = sanitizeHtml(input.poll?.question ?? '', { allowedTags: [], allowedAttributes: {} }).trim() || null;
    const pollOptions = (input.poll?.options ?? [])
      .map((option) => sanitizeHtml(option, { allowedTags: [], allowedAttributes: {} }).trim())
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
      ? await prisma.auditLog.findFirst({ where: { action: `post:${input.idempotencyKey}`, userId } })
      : null;

    if (existing) {
      const post = await prisma.post.findFirst({ where: { authorId: userId, content }, orderBy: { createdAt: 'desc' } });
      if (post) {
        return prisma.post.findUnique({
          where: { id: post.id },
          include: {
            author: { select: publicUserSelect },
            _count: { select: { comments: true, likes: true, reposts: true } }
          }
        });
      }
    }

    const post = await prisma.post.create({
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

    const createdPost = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true, likes: true, reposts: true } }
      }
    });

    // ✅ Emit real-time event for new post - broadcasts to all connected clients through Redis
    // With Redis adapter, this propagates across all backend replicas automatically
    if (createdPost) {
      const io = getSocketServer();
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
  async feed(userId: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null,
        OR: [
          // Own posts
          { authorId: userId },
          // Accepted follows — any audience
          { author: { followers: { some: { followerId: userId, status: 'ACCEPTED' } } } },
          // Public posts from public accounts only
          { audience: 'PUBLIC', author: { isPrivate: false } }
        ]
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true, likes: true, reposts: true } }
      }
    });

    const hasMore = posts.length > limit;
    const pageItems = hasMore ? posts.slice(0, limit) : posts;
    const enriched = await this.enrichWithLikeStatus(pageItems, userId);
    return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /**
   * Returns trending posts for explore.
   * - Public posts are visible to everyone.
   * - Followers-only posts are only visible to accepted followers and the author.
   */
  async explore(cursor?: string, limitInput?: string, viewerId?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const orConditions: any[] = [{ audience: 'PUBLIC', author: { isPrivate: false } }];

    if (viewerId) {
      orConditions.push(
        { audience: 'FOLLOWERS_ONLY', author: { followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } } },
        { authorId: viewerId },
        { audience: 'PUBLIC', author: { isPrivate: true, followers: { some: { followerId: viewerId, status: 'ACCEPTED' } } } }
      );
    }

    const posts = await prisma.post.findMany({
      where: { deletedAt: null, OR: orConditions },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true, likes: true, reposts: true } }
      }
    });
    const hasMore = posts.length > limit;
    const pageItems = hasMore ? posts.slice(0, limit) : posts;
    const enriched = viewerId ? await this.enrichWithLikeStatus(pageItems, viewerId) : pageItems;
    return { items: enriched, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Returns a single post with its reply thread. */
  async getById(postId: string, viewerId?: string) {
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: {
        author: { select: publicUserSelect },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: publicUserSelect } }
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: publicUserSelect } }
        },
        _count: { select: { comments: true, likes: true, reposts: true } }
      }
    });

    if (!post) throw new Error('Post not found');

    if (viewerId && viewerId !== post.authorId) {
      const follow = await prisma.follow.findFirst({
        where: {
          followerId: viewerId,
          followingId: post.authorId,
          status: 'ACCEPTED'
        }
      });

      if (post.author.isPrivate && !follow) {
        throw new Error('Post not found');
      }
      if (post.audience === 'FOLLOWERS_ONLY' && !follow) {
        throw new Error('Post not found');
      }
    }

    if (!viewerId && post.author.isPrivate) {
      throw new Error('Post not found');
    }

    if (viewerId) {
      const [likeRow, repostRow] = await Promise.all([
        prisma.like.findUnique({ where: { userId_postId: { userId: viewerId, postId } } }),
        prisma.repost.findUnique({ where: { userId_postId: { userId: viewerId, postId } } })
      ]);
      return { ...post, isLiked: Boolean(likeRow), isReposted: Boolean(repostRow), viewerId };
    }

    return { ...post, isLiked: false, isReposted: false, viewerId: null };
  }

  /** Soft deletes the given post if the caller owns it. */
  async softDelete(postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findFirst({ where: { id: postId, authorId: userId, deletedAt: null } });
    if (!post) throw new Error('Post not found');
    await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  /** Toggles a like on the post and returns the new state. */
  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const existing = await prisma.like.findUnique({ where: { userId_postId: { userId, postId } } });
    const io = getSocketServer();
    
    if (existing) {
      await prisma.like.delete({ where: { userId_postId: { userId, postId } } });
      const post = await prisma.post.update({ where: { id: postId }, data: { likesCount: { decrement: 1 } } });
      
      // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
      if (io) {
        io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
        io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
      }
      
      return { liked: false, likesCount: post.likesCount };
    }
    
    await prisma.like.create({ data: { userId, postId } });
    const post = await prisma.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
    
    // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
    if (io) {
      io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
      io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
    }
    
    if (post.authorId !== userId) {
      await NotificationsService.createAndEmit({
        recipientId: post.authorId, actorId: userId,
        type: 'LIKE', entityType: 'POST', entityId: postId
      });
    }
    return { liked: true, likesCount: post.likesCount };
  }

  /** Toggles a repost on the post and returns the new state. */
  async toggleRepost(postId: string, userId: string): Promise<{ reposted: boolean; repostsCount: number }> {
    const existing = await prisma.repost.findUnique({ where: { userId_postId: { userId, postId } } });
    const io = getSocketServer();
    
    if (existing) {
      await prisma.repost.delete({ where: { userId_postId: { userId, postId } } });
      const post = await prisma.post.update({ where: { id: postId }, data: { repostsCount: { decrement: 1 } } });
      
      // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
      if (io) {
        io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
        io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
      }
      
      return { reposted: false, repostsCount: post.repostsCount };
    }
    
    await prisma.repost.create({ data: { userId, postId } });
    const post = await prisma.post.update({ where: { id: postId }, data: { repostsCount: { increment: 1 } } });
    
    // ✅ Emit post update to feed/explore rooms (broadcasts across replicas)
    if (io) {
      io.to('feed').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
      io.to('explore').emit('post_updated', { postId, likesCount: post.likesCount, repostsCount: post.repostsCount });
    }
    
    if (post.authorId !== userId) {
      await NotificationsService.createAndEmit({
        recipientId: post.authorId, actorId: userId,
        type: 'REPOST', entityType: 'POST', entityId: postId
      });
    }
    return { reposted: true, repostsCount: post.repostsCount };
  }

  /** Lists users who liked a post. */
  async listLikes(postId: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const likes = await prisma.like.findMany({
      where: { postId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: publicUserSelect } }
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
  async postsByUser(username: string, cursor?: string, limitInput?: string, viewerId?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const user = await prisma.user.findFirst({ where: { username: username.toLowerCase(), deletedAt: null } });
    if (!user) throw new Error('User not found');

    const isSelfViewing = viewerId === user.id;
    const isFollower = viewerId && !isSelfViewing
      ? await prisma.follow.findFirst({
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

    const posts = await prisma.post.findMany({
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
        author: { select: publicUserSelect },
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
  private async enrichWithLikeStatus<T extends { id: string }>(posts: T[], viewerId: string): Promise<(T & { isLiked: boolean; isReposted: boolean })[]> {
    if (posts.length === 0) return posts.map((p) => ({ ...p, isLiked: false, isReposted: false }));

    const ids = posts.map((p) => p.id);
    const [likes, reposts] = await Promise.all([
      prisma.like.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
      prisma.repost.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } })
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