import { FollowersService } from '../src/modules/followers/followers.service';

const prismaMocks = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  follow: { upsert: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), update: jest.fn() }
};

jest.mock('../src/config/prisma', () => ({ prisma: prismaMocks }));

describe('FollowersService', () => {
  it('creates an accepted follow for public users', async () => {
    prismaMocks.user.findUnique.mockResolvedValue({ id: 'user-2', isPrivate: false });
    prismaMocks.follow.upsert.mockResolvedValue({ id: 'follow-1', status: 'ACCEPTED' });

    const service = new FollowersService();
    const result = await service.follow('user-1', 'user-2');

    expect(result.status).toBe('ACCEPTED');
    expect(prismaMocks.follow.upsert).toHaveBeenCalled();
  });
});
