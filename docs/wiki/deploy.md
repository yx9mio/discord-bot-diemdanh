# Deploy

## Build

- `Dockerfile` — Node 20 bookworm-slim, ARM64-ready (multi-arch), cài native deps.
- `@napi-rs/canvas` dùng font bundled `assets/fonts/` (DejaVuSans) — không phụ thuộc system fonts.
- `railway.toml` — cấu hình deploy Railway.
- `ecosystem.config.cjs` — PM2 config cho VPS.

## Railway

1. Push code → GitHub
2. Railway: New Project → Deploy from repo
3. Set env vars (xem `.env.example`): `DISCORD_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`, `NODE_ENV`, `GUILD_ID`
4. Railway tự build qua Dockerfile

## VPS (PM2)

```bash
git pull
npm ci --omit=dev
npm run lint
cp .env.example .env   # điền đầy đủ
pm2 start ecosystem.config.cjs
pm2 logs discord-bot
```

## CI

`.github/workflows/ci.yml` chạy trên mỗi push/PR: lint + `npm run test:ci` (68 tests).
Không cần Supabase trong CI.

## Migrations khi deploy

```bash
npm run supabase:push         # push migrations chưa áp dụng lên remote
npm run supabase:remote-types # regenerate types.ts nếu schema thay đổi
```

Migration mới nên **idempotent** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
Xem [Recovery Runbook](../recovery.md) cho các tình huống vận hành.
