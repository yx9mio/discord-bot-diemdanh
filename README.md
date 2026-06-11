# 📋 Discord Bot Điểm Danh

Bot Discord điểm danh — **JS CJS + Sapphire v5 + discord.js v14 + Supabase**.

## Quick start

```bash
cp .env.example .env   # điền DISCORD_TOKEN + SUPABASE_URL + SUPABASE_KEY
npm install
npm run dev             # nodemon auto-restart
```

## Supabase CLI

```bash
# Install (npm local dev dep — đã có trong devDependencies)
npm run supabase:link      # link to remote project
npm run supabase:push      # push local migrations → remote
npm run supabase:pull      # pull remote schema → local
npm run supabase:types     # generate TS types (docs)
npm run supabase:stop      # stop local services
```

Project already linked to `discord-bot-diemdanh` (ref: `rtvnogxasuswfnugcoyr`).

### Migration workflow

```bash
# Sau khi sửa schema local:
supabase db push   # apply to remote

# Sau khi sửa schema trên dashboard:
supabase db pull   # capture as new migration
```

Tất cả migration đều dùng `IF NOT EXISTS` — an toàn chạy nhiều lần.

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
├── supabase/
│   ├── migrations/         # DB schema (init + incremental)
│   ├── seed.sql            # sample data for dev
│   ├── types.ts            # generated TS types (docs only)
│   └── config.toml         # Supabase local config
└── events/                 # health check server
```

## Deploy

Auto-deploy qua Railway (push → Docker build → deploy).

## Lệnh chính

- `/setup` — dashboard: mở phiên, quản lý, cấu hình, thống kê
- `/help` — danh sách lệnh

## Env

Xem `.env.example`.
