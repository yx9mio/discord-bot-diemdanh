# Services

| Service | Trách nhiệm | Bảng |
|---|---|---|
| `_client.js` | Singleton Supabase client, `_throwSupabase`, `_validate*`, `SESSION_TIME_COLUMN` | — |
| `attendanceService.js` | Điểm danh, lock phân tán L1+L2, `bulkInsertAbsent` | `attendances`, `attendance_locks` |
| `sessionService.js` | CRUD phiên, mở/đóng/huỷ | `sessions` |
| `memberService.js` | CRUD thành viên, stats, streak, leaderboard, badge | `members`, `member_stats`, `member_badges`, `badges`, `sessions`, `attendances` |
| `scheduledService.js` | CRUD lịch (recurring/one-time), reminders | `scheduled_sessions`, `reminders` |
| `configService.js` | Config per-guild, đảm bảo config tồn tại | `guild_configs` |
| `guildEmojiService.js` | Cache custom emoji per guild | `guild_emojis` |
| `reminderScheduler.js` | Tick mỗi phút: reminder + auto-open phiên | qua các service khác |

## API conventions

- Function `async`, trả `{ data, error }` style hoặc throw qua `_throwSupabase`.
- Filter luôn có `guild_id` (guild-scoped) trừ hệ thống/system paths.
- Upsert dùng `onConflict` rõ ràng:
  - `members`: `guild_id,user_id`
  - `member_stats`: `guild_id,user_id`
  - `member_badges`: `guild_id,user_id,threshold`
  - `attendances`: `session_id,user_id`
  - `guild_configs`: `guild_id`

## Ví dụ luồng điểm danh

1. `attendanceSelect.js` (USER) → `upsertAttendance` → L1 advisory lock + L2 table lock
2. Insert `attendances` nếu chưa tồn tại; nếu trùng `(session_id,user_id)` → reject
3. Audit log qua `utils/auditLog.js` nếu là admin mark/edit
