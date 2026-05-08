import sanitizeHtml from 'sanitize-html';
import { redis } from '@config/redis';
import { prisma } from '@config/prisma';
import { publicUserSelect } from '@modules/shared';
import { parseLimit } from '@utils/pagination';

export class UsersService {
  /**
   * Returns the authenticated user's profile.
   * ✅ FIX: include _count so followersCount / followingCount / postsCount are
   * populated in the frontend instead of always showing 0.
   */
  async getMe(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicUserSelect,
        _count: {
          select: { posts: true }
        }
      }
    });
    if (!profile) throw new Error('User not found');

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId, status: 'ACCEPTED' } }),
      prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } })
    ]);

    return {
      ...profile,
      followersCount,
      followingCount
    };
  }

  /** Updates the current user's public profile. */
  async updateMe(
    userId: string,
    input: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      username?: string;
      isPrivate?: boolean;
    }
  ) {
    // Check if username is already taken by another user
    if (input.username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: input.username.toLowerCase(),
          id: { not: userId }
        }
      });
      if (existing) {
        throw new Error('Username already taken');
      }
    }

    const profile = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName
          ? sanitizeHtml(input.displayName, { allowedTags: [], allowedAttributes: {} })
          : undefined,
        bio:
          input.bio === undefined
            ? undefined
            : input.bio
            ? sanitizeHtml(input.bio, { allowedTags: [], allowedAttributes: {} })
            : null,
        avatarUrl: input.avatarUrl ?? undefined,
        bannerUrl: input.bannerUrl ?? undefined,
        username: input.username ? input.username.toLowerCase() : undefined,
        isPrivate: input.isPrivate
      },
      select: {
        ...publicUserSelect,
        _count: { select: { followers: true, following: true, posts: true } }
      }
    });
    return profile;
  }

  /** Searches users by username or display name with cursor pagination. */
  async search(query: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: publicUserSelect,
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
  async getByUsername(username: string, viewerId?: string) {
    const user = await prisma.user.findFirst({
      where: { username: username.toLowerCase(), deletedAt: null },
      select: {
        ...publicUserSelect,
        followers: {
          where: viewerId ? { followerId: viewerId } : { followerId: '' },
          select: { status: true }
        },
        _count: {
          select: { posts: true }
        }
      }
    });

    if (!user) throw new Error('User not found');

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id, status: 'ACCEPTED' } }),
      prisma.follow.count({ where: { followerId: user.id, status: 'ACCEPTED' } })
    ]);

    const followStatus = user.followers[0]?.status ?? null;
    return {
      ...user,
      followersCount,
      followingCount,
      isFollowing: followStatus === 'ACCEPTED',
      isPending: followStatus === 'PENDING'
    };
  }

  /**
   * Checks if a user is currently online by looking up their presence in Redis.
   * Returns { isOnline: boolean, lastSeen?: timestamp }
   */
  async isUserOnline(userId: string) {
    const presenceCount = await redis.scard(`presence:${userId}`);
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
  async checkUsersOnline(userIds: string[]) {
    if (!userIds.length) return [];
    
    const presences = await Promise.all(
      userIds.map(id => redis.scard(`presence:${id}`))
    );

    return userIds.map((userId, index) => ({
      userId,
      isOnline: presences[index] > 0,
      timestamp: new Date().toISOString()
    }));
  }
}