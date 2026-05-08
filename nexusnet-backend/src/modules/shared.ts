import type { Prisma } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  bannerUrl: true,
  isPrivate: true,
  isVerified: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export type CursorPagination = {
  nextCursor: string | null;
  hasMore: boolean;
};
