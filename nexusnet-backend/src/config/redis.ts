import Redis from 'ioredis';
import CircuitBreaker from 'opossum';
import { env } from './env';
import { logger } from './logger';

/**
 * Crea el cliente Redis con soporte para Sentinel.
 *
 * - Si REDIS_SENTINEL_HOSTS está definida (producción/Kubernetes):
 *   ioredis se conecta a los 3 sentinels, descubre el master actual y
 *   reconecta automáticamente si el master cae y Sentinel promueve una réplica.
 *
 * - Si no está definida (dev local con docker-compose):
 *   usa REDIS_URL directamente, mismo comportamiento que antes.
 */
function createRedisClient(): Redis {
  if (env.REDIS_SENTINEL_HOSTS) {
    // Parsear "host1:port1,host2:port2,host3:port3"
    const sentinels = env.REDIS_SENTINEL_HOSTS.split(',').map((entry) => {
      const [host, portStr] = entry.trim().split(':');
      return { host, port: parseInt(portStr ?? '26379', 10) };
    });

    logger.info(
      { sentinels, name: env.REDIS_SENTINEL_NAME },
      'Redis: conectando en modo Sentinel'
    );

    return new Redis({
      sentinels,
      name: env.REDIS_SENTINEL_NAME,    // nombre del grupo definido en sentinel.conf
      password: process.env.REDIS_PASSWORD,
      // Reintentos de reconexión tras failover (Sentinel puede tardar ~10-15s)
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Esperar hasta 5s entre reintentos, con backoff exponencial
        const delay = Math.min(times * 500, 5000);
        logger.warn({ times, delay }, 'Redis: reintentando conexión...');
        return delay;
      },
      sentinelRetryStrategy: (times) => Math.min(times * 500, 5000),
    });
  }

  // Modo simple (dev local)
  logger.info({ url: env.REDIS_URL }, 'Redis: conectando en modo standalone');
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
}

const redisClient = createRedisClient();

redisClient.on('connect', () => logger.info('Redis: conectado'));
redisClient.on('ready', () => logger.info('Redis: listo'));
redisClient.on('error', (err) => logger.error({ err }, 'Redis: error'));
redisClient.on('close', () => logger.warn('Redis: conexión cerrada'));
redisClient.on('+failover-end', () => logger.info('Redis Sentinel: failover completado'));
redisClient.on('+switch-master', (master: string) =>
  logger.warn({ master }, 'Redis Sentinel: master cambiado')
);

// Circuit breaker: abre si >50% de operaciones fallan en una ventana de 5s.
// Se resetea automáticamente después de 15s para probar si Redis volvió.
const redisBreaker = new CircuitBreaker(
  async <T>(operation: () => Promise<T>): Promise<T> => operation(),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000,
  }
);

redisBreaker.on('open', () => logger.warn('Redis circuit breaker: ABIERTO (Redis no disponible)'));
redisBreaker.on('halfOpen', () => logger.info('Redis circuit breaker: probando reconexión...'));
redisBreaker.on('close', () => logger.info('Redis circuit breaker: CERRADO (Redis recuperado)'));

export const redis = redisClient;

export async function redisCall<T>(operation: () => Promise<T>): Promise<T> {
  return redisBreaker.fire(operation) as Promise<T>;
}
