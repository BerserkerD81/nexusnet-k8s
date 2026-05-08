import sanitizeHtml from 'sanitize-html';
import { prisma } from '@config/prisma';
import { publicUserSelect } from '@modules/shared';
import { NotificationsService } from '@modules/notifications/notifications.service';

export class CommentsService {
  /** Adds a sanitized comment to a post. */
  async add(postId: string, userId: string, content: string) {
    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        content: sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} })
      }
    });
    await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, parentId: true } });
    if (post && post.authorId !== userId) {
      // Notification to the post author
      await NotificationsService.createAndEmit({
        recipientId: post.authorId,
        actorId: userId,
        type: 'COMMENT',
        entityType: 'POST',
        entityId: postId
      });
    }

    // If this post is itself a reply, also notify the original post author with REPLY
    if (post?.parentId) {
      const parent = await prisma.post.findUnique({ where: { id: post.parentId }, select: { authorId: true } });
      if (parent && parent.authorId !== userId && parent.authorId !== post.authorId) {
        await NotificationsService.createAndEmit({
          recipientId: parent.authorId,
          actorId: userId,
          type: 'REPLY',
          entityType: 'POST',
          entityId: postId
        });
      }
    }

    return prisma.comment.findUnique({
      where: { id: comment.id },
      include: { author: { select: publicUserSelect } }
    });
  }

  /** Soft deletes the user's own comment. */
  async softDelete(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.comment.findFirst({ where: { id: commentId, authorId: userId, deletedAt: null } });
    if (!comment) throw new Error('Comment not found');
    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  }

  /** Toggles a like on a comment. Emits COMMENT_LIKE notification to comment author. */
  async toggleLike(commentId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const existing = await prisma.commentLike.findUnique({ where: { userId_commentId: { userId, commentId } } });
    if (existing) {
      await prisma.commentLike.delete({ where: { userId_commentId: { userId, commentId } } });
      const comment = await prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } });
      return { liked: false, likesCount: comment.likesCount };
    }

    await prisma.commentLike.create({ data: { userId, commentId } });
    const comment = await prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } });

    if (comment.authorId !== userId) {
      await NotificationsService.createAndEmit({
        recipientId: comment.authorId,
        actorId: userId,
        type: 'COMMENT_LIKE',
        entityType: 'COMMENT',
        entityId: commentId
      });
    }

    return { liked: true, likesCount: comment.likesCount };
  }
}
