# Architecture

## Runtime

- **Node.js ≥ 20**, CommonJS (`"type": "commonjs"`)
- **Entry**: `index.js` — khởi tạo Sapphire client, register slash commands, start scheduler
- **Discord**: `@sapphire/framework` v5 + `discord.js` v14
- **DB**: Supabase (PostgreSQL) qua `@supabase/supabase-js`
- **Canvas**: `@napi-rs/canvas` — font bundled trong `assets/fonts/` (`DejaVuSans`, `DejaVuSans-Bold`)

## Layer

```
index.js
  ├── src/commands/          # Slash commands (/help, /setup)
  ├── src/interaction-handlers/  # Button / select / modal xử lý
  ├── src/listeners/         # Discord events (ready, messageDelete, guildCreate...)
  ├── services/              # Business logic + DB access (duy nhất layer gọi Supabase)
  │   ├── _client.js         # Singleton Supabase client + validators
  │   ├── attendanceService.js
  │   ├── sessionService.js
  │   ├── memberService.js
  │   ├── scheduledService.js
  │   ├── configService.js
  │   ├── guildEmojiService.js
  │   └── reminderScheduler.js   # Scheduler nhắc nhở + auto-open
  ├── utils/                 # Pure/shared utilities (không gọi DB trừ auditLog, schedulerLock)
  ├── supabase/migrations/   # SQL migrations
  └── tests/                 # Vitest
```

## Nguyên tắc

1. **Chỉ `services/` gọi Supabase.** `utils/` và `src/` không truy cập DB trực tiếp.
   Ngoại lệ: `utils/auditLog.js`, `utils/schedulerLock.js` (vì lý do lịch sử, dùng chung `_client.js`).
2. **Fail-closed.** Hàm phân tán lock trả về `false` khi gặp lỗi bất kỳ, không bao giờ
   fail-open (an toàn hơn khi DB không khả dụng).
3. **Validation qua zod** (`utils/validate.js`).
4. **Mọi mutation admin đi qua `requireAdmin` + audit log + cooldown.** Xem
   [Query Inventory](../query-inventory.md).

## Distributed lock — attendance

Hai tầng chống race condition khi nhiều user điểm danh cùng phiên:

- **L1 (advisory lock)**: RPC `try_advisory_lock` (pg-level), giải phóng tự động khi kết thúc transaction.
- **L2 (table lock)**: insert vào `attendance_locks (session_id, user_id)` với composite PK —
  insert trùng lặp thất bại (23505) → request bị reject. `cleanup_stale_locks()` xoá lock
  cũ hơn 60s cho trường hợp instance crash. Quan trọng: `session_id` là `uuid`, `user_id` là `text`
  (đã fix từ `bigint` — trước đây insert sai type lặng lẽ bypass lock).

## Scheduler — multi-instance safety

`reminderScheduler.js` chạy mỗi phút, bảo vệ bởi leadership lock trong `scheduler_locks`
(RPC `try_acquire_scheduler_lock` / `release_scheduler_lock`, TTL 70s + heartbeat 30s
qua `utils/schedulerLock.js`). Chỉ instance giữ lock mới tick, tránh duplicate reminder/auto-open.
