# 📋 Discord Bot Điểm Danh

Bot Discord điểm danh — **JS CJS + Sapphire v5 + discord.js v14 + Supabase**.

## Quick start

```bash
cp .env.example .env   # điền DISCORD_TOKEN + SUPABASE_URL + SUPABASE_KEY
npm install
npm run dev            # nodemon auto-restart
```

## Cấu trúc

```
├── index.js                # entry point
├── src/
│   ├── commands/           # slash commands: /setup, /help
│   ├── interaction-handlers/  # buttons, selects, modals
│   └── listeners/          # ready, guildDelete, messageDelete
├── services/               # DB access (Supabase)
├── utils/                  # helpers, views, logger
│   ├── _views/             # embed builders
│   ├── channel.js          # channel cache fallback
│   ├── embeds.js           # barrel re-export
│   ├── error-boundary.js   # global error wrapper
│   ├── logger.js           # pino logger
│   └── ...
├── supabase/migrations/    # DB schema migrations
└── events/                 # health check server
```

## Deploy

Auto-deploy qua Railway (push → Docker build → deploy).

## Lệnh chính

- `/setup` — dashboard: mở phiên, quản lý, cấu hình, thống kê
- `/help` — danh sách lệnh

## Env

Xem `.env.example`.
