"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promClient = exports.activeUsers = exports.websocketConnections = exports.httpRequestDuration = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
exports.promClient = prom_client_1.default;
prom_client_1.default.collectDefaultMetrics();
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'nexusnet_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code']
});
exports.websocketConnections = new prom_client_1.default.Gauge({
    name: 'nexusnet_websocket_connections',
    help: 'Active Socket.IO connections'
});
exports.activeUsers = new prom_client_1.default.Gauge({
    name: 'nexusnet_active_users',
    help: 'Active online users tracked in Redis'
});
