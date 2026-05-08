import { Queue } from 'bullmq';
import { redis } from '@config/redis';

export const notificationQueue = new Queue('notifications', {
  connection: redis.duplicate()
});

export const notificationDeadLetterQueue = new Queue('notifications-dlq', {
  connection: redis.duplicate()
});

export const emailQueue = new Queue('emails', {
  connection: redis.duplicate()
});
