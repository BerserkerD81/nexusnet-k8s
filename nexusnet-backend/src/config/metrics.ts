import client from 'prom-client';

client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: 'nexusnet_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const websocketConnections = new client.Gauge({
  name: 'nexusnet_websocket_connections',
  help: 'Active Socket.IO connections'
});

export const activeUsers = new client.Gauge({
  name: 'nexusnet_active_users',
  help: 'Active online users tracked in Redis'
});

export { client as promClient };
