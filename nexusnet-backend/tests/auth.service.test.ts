import { AuthService } from '../src/modules/auth/auth.service';

const prismaMocks = {
  user: { create: jest.fn() },
  session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  auditLog: { create: jest.fn() }
};

jest.mock('../src/config/prisma', () => ({
  prisma: prismaMocks,
  prismaQuery: async <T>(operation: () => Promise<T>) => operation()
}));

jest.mock('../src/config/redis', () => ({
  redis: { set: jest.fn(), del: jest.fn(), ping: jest.fn(), quit: jest.fn() },
  redisCall: async <T>(operation: () => Promise<T>) => operation()
}));

jest.mock('../src/utils/crypto', () => ({
  hashPassword: async () => 'hashed-password',
  verifyPassword: async () => true
}));

describe('AuthService', () => {
  it('registers a user and returns tokens', async () => {
    prismaMocks.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      username: 'alice',
      displayName: 'Alice',
      bio: null,
      avatarUrl: null,
      bannerUrl: null,
      isPrivate: false,
      isVerified: false,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    prismaMocks.session.create.mockResolvedValue({});
    prismaMocks.auditLog.create.mockResolvedValue({});

    const service = new AuthService();
    const result = await service.register({
      email: 'alice@example.com',
      username: 'alice',
      password: 'password123',
      displayName: 'Alice'
    });

    expect(result.user.email).toBe('alice@example.com');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(prismaMocks.user.create).toHaveBeenCalled();
  });
});
