"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const http_1 = require("../utils/http");
const logger_1 = require("../config/logger");
function notFoundHandler(req, res) {
    res.status(404).json((0, http_1.errorResponse)(`Route not found: ${req.method} ${req.originalUrl}`));
}
function errorHandler(error, _req, res, _next) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = typeof error.status === 'number'
        ? error.status
        : 500;
    logger_1.logger.error({ error }, 'Unhandled error');
    res.status(status).json((0, http_1.errorResponse)(message));
}
