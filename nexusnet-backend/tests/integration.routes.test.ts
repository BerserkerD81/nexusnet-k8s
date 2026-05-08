import request from 'supertest';

const prismaMocks = {
  $queryRaw: jest.fn().mockResolvedValue(1)
};

const redisMocks = {
  ping: jest.fn().mockResolvedValue('PONG')
};

jest.mock('../src/config/prisma', () => ({ prisma: prismaMocks }));
jest.mock('../src/config/redis', () => ({ redis: redisMocks }));

import { createApp } from '../src/app';

describe('API shell', () => {
  it('serves health and readiness endpoints', async () => {
    const app = createApp();

    await request(app).get('/health').expect(200);
    await request(app).get('/ready').expect(200);
  });
});
