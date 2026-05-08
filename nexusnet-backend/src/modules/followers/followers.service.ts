import { prisma } from '@config/prisma';
import { parseLimit } from '@utils/pagination';
import { publicUserSelect } from '@modules/shared';
import { NotificationsService } from '@modules/notifications/notifications.service';

export class FollowersService {
  /** Creates a follow relationship, respecting private account requests. */
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      const error = new Error('You cannot follow yourself');
      (error as { status?: number }).status = 400;
      throw error;
    }
    const target = await prisma.user.findUnique({ where: { id: followingId } });
    if (!target) {
      throw new Error('User not found');
    }

    const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';
    const relation = await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: { status },
      create: { followerId, followingId, status }
    });

    if (followerId !== followingId) {
      await NotificationsService.createAndEmit({
        recipientId: followingId, actorId: followerId,
        type: 'FOLLOW', entityType: 'FOLLOW', entityId: relation.id
      });
    }

    return relation;
  }

  /** Removes a follow relationship. */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    await prisma.follow.deleteMany({ where: { followerId, followingId } });
  }

  /** Accepts or rejects a pending follow request on a private account. */
  async respondToRequest(userId: string, followerId: string, accepted: boolean) {
    const follow = await prisma.follow.findFirst({ where: { followingId: userId, followerId, status: 'PENDING' } });
    if (!follow) {
      throw new Error('Follow request not found');
    }
    if (!accepted) {
      await prisma.follow.delete({ where: { id: follow.id } });
      return { accepted: false };
    }
    return prisma.follow.update({ where: { id: follow.id }, data: { status: 'ACCEPTED' } });
  }

  /** Lists followers with cursor pagination. */
  async listFollowers(userId: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const relations = await prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: publicUserSelect } }
    });
    const hasMore = relations.length > limit;
    const pageItems = hasMore ? relations.slice(0, limit) : relations;
    return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Lists following accounts with cursor pagination. */
  async listFollowing(userId: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const relations = await prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { following: { select: publicUserSelect } }
    });
    const hasMore = relations.length > limit;
    const pageItems = hasMore ? relations.slice(0, limit) : relations;
    return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Lists pending follow requests for a private account. */
  async listRequests(userId: string, cursor?: string, limitInput?: string) {
    const limit = parseLimit(limitInput, 20, 50);
    const relations = await prisma.follow.findMany({
      where: { followingId: userId, status: 'PENDING' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { follower: { select: publicUserSelect } }
    });
    const hasMore = relations.length > limit;
    const pageItems = hasMore ? relations.slice(0, limit) : relations;
    return { items: pageItems, pagination: { nextCursor: pageItems.at(-1)?.id ?? null, hasMore } };
  }

  /** Removes a follower from the current user's followers list. */
  async removeFollower(userId: string, followerId: string): Promise<void> {
    await prisma.follow.deleteMany({ where: { followingId: userId, followerId } });
  }

  /** Suggests accounts to follow based on mutual edges. */
  async suggestions(userId: string) {
    const suggestions = await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: userId },
        following: { none: { followerId: userId } }
      },
      select: publicUserSelect,
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    return suggestions;
  }
}
