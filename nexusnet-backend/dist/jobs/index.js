"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = exports.notificationDeadLetterQueue = exports.notificationQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.notificationQueue = new bullmq_1.Queue('notifications', {
    connection: redis_1.redis.duplicate()
});
exports.notificationDeadLetterQueue = new bullmq_1.Queue('notifications-dlq', {
    connection: redis_1.redis.duplicate()
});
exports.emailQueue = new bullmq_1.Queue('emails', {
    connection: redis_1.redis.duplicate()
});
