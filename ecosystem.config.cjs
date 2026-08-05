// PM2 ecosystem — chạy bot trực tiếp trên VPS (Ubuntu ARM64)
// Dùng: pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
'use strict';

module.exports = {
  apps: [
    {
      name: 'discord-bot-diemdanh',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '256M',
      time: true,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Ho_Chi_Minh',
        NODE_OPTIONS: '--max-old-space-size=256',
      },
    },
  ],
};
