// events/healthServer.js — L-3: HTTP health endpoint cho Railway keepalive
'use strict';
const http = require('http');
const log  = require('../utils/logger.js');

/**
 * Khởi động HTTP server nhỏ trên PORT (env) để Railway / UptimeRobot ping.
 * Trả về 200 JSON khi bot online, 503 nếu client chưa sẵn sàng.
 */
function startHealthServer(client) {
  const port = Number(process.env.PORT) || 3000;

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const ready = client?.isReady?.() ?? false;
      const body  = JSON.stringify({
        status : ready ? 'ok' : 'starting',
        uptime : Math.floor(process.uptime()),
        ping   : client?.ws?.ping ?? -1,
        guilds : client?.guilds?.cache?.size ?? 0,
      });
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
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
