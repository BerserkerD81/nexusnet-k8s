"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.prismaQuery = prismaQuery;
const client_1 = require("@prisma/client");
const opossum_1 = __importDefault(require("opossum"));
const logger_1 = require("./logger");
const prismaClient = new client_1.PrismaClient({
    log: ['error', 'warn']
});
const queryBreaker = new opossum_1.default(async (operation) => operation(), {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
});
queryBreaker.on('open', () => logger_1.logger.warn('Prisma circuit breaker opened'));
queryBreaker.on('close', () => logger_1.logger.info('Prisma circuit breaker closed'));
exports.prisma = prismaClient;
async function prismaQuery(operation) {
    return queryBreaker.fire(operation);
}
