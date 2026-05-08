import { PrismaClient } from '@prisma/client';
import CircuitBreaker from 'opossum';
import { logger } from './logger';

const prismaClient = new PrismaClient({
  log: ['error', 'warn']
});

const queryBreaker = new CircuitBreaker(
  async <T>(operation: () => Promise<T>): Promise<T> => operation(),
  {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

queryBreaker.on('open', () => logger.warn('Prisma circuit breaker opened'));
queryBreaker.on('close', () => logger.info('Prisma circuit breaker closed'));

export const prisma = prismaClient;

export async function prismaQuery<T>(operation: () => Promise<T>): Promise<T> {
  return queryBreaker.fire(operation) as Promise<T>;
}
