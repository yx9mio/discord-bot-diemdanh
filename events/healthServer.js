// events/healthServer.js — HTTP health endpoint cho Railway keepalive.
'use strict';
const http = require('http');
const log  = require('../utils/logger.js');

// Grace period 20s: Railway không kill container trong lúc bot đang connect Discord
const START_TIME = Date.now();
const GRACE_MS   = 20_000;

function startHealthServer(client) {
  const port = Number(process.env.PORT) || 3000;

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const ready       = client?.isReady?.() ?? false;
      const inGrace     = (Date.now() - START_TIME) < GRACE_MS;
      // Trả 200 khi bot đã ready HOẶC vẫn trong grace period khởi động.
      // Chỉ trả 503 khi đã qua grace period mà bot vẫn chưa ready (mất kết nối thực sự).
      const statusCode  = (ready || inGrace) ? 200 : 503;
      const body        = JSON.stringify({
        status : ready ? 'ok' : (inGrace ? 'starting' : 'unhealthy'),
        uptime : Math.floor(process.uptime()),
        ping   : client?.ws?.ping ?? -1,
        guilds : client?.guilds?.cache?.size ?? 0,
      });
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.on('error', err => log.warn('HEALTH', null, 'HTTP server lỗi: %s', err.message));
  server.listen(port, () => log.info('HEALTH', null, 'Health endpoint: http://0.0.0.0:%s/health', port));
  return server;
}

module.exports = { startHealthServer };
