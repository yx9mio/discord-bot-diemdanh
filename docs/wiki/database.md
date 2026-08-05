# Database

Schema nguồn sự thật: `supabase/migrations/*.sql` (versioned, idempotent).
Kiểm tra drift giữa code ↔ schema tự động bằng `tests/schemaDrift.test.mjs`.

## Bảng

| Bảng | PK | Ghi chú |
|---|---|---|
| `guild_configs` | `guild_id text` | timezone, roles, `phai_role_ids text[]`, `phai_role_icons jsonb` |
| `sessions` | `id uuid` | `is_active`, `cancelled`, `auto_close_at`, `phai_role_ids` |
| `attendances` | `id uuid` + UNIQUE(`session_id`,`user_id`) | `status` (`tham_gia`/`tre`/`co_phep`/`khong_tham_gia`), `checked_in_at` |
| `members` | `id bigserial` + UNIQUE(`guild_id`,`user_id`) | `phong_ban`, `ghi_chu`, `phai_role_ids text[]` |
| `member_stats` | `id bigserial` + UNIQUE(`guild_id`,`user_id`) | streak, totals, `last_attended_at` |
| `badges` | `id serial` + UNIQUE(`guild_id`,`threshold`) | |
| `member_badges` | `id serial` + UNIQUE(`guild_id`,`user_id`,`threshold`) | FK composite → badges |
| `scheduled_sessions` | `id uuid` | recurring/one_time, 2 mốc reminder, `skip_until` |
| `reminders` | `id uuid` | legacy scheduler, `due_at`, `sent_at` |
| `guild_emojis` | UNIQUE(`guild_id`,`emoji_id`) | cache emoji custom |
| `attendance_locks` | PK(`session_id`,`user_id`) | lock phân tán điểm danh |
| `scheduler_locks` | `job_name text` | lock leadership scheduler |
| `audit_logs` | `id bigint identity` | metadata jsonb |

## RLS

Mọi bảng: policy `service_role_all` FOR ALL → service_role. Bot dùng service role key.

## Hàm (RPC)

- `try_advisory_lock`, `advisory_unlock` — lock point-in-time
- `cleanup_stale_locks()` — xoá attendance_locks cũ > 60s
- `try_acquire_scheduler_lock(p_job_name, p_instance_id, p_ttl_seconds)`, `release_scheduler_lock`
- Triggers `update_*_updated_at` trên `guild_configs`, `members`, `member_stats`

## Migrations đáng chú ý

- `20260618000001_fix_attendance_locks_types.sql` — `session_id` bigint→uuid, `user_id` bigint→text
  (fix lock bị bypass). **Không revert** — composite PK bắt buộc đúng type.
- `20260805000001_add_missing_members_phai_columns.sql` — thêm `members.phai_role_ids`
  (drift phát hiện bởi schemaDrift test).

## Lệnh

```bash
npm run supabase:push          # push migrations lên remote
npm run supabase:pull          # pull schema từ remote
npm run supabase:remote-types  # regenerate supabase/types.ts từ linked DB
npm run db:reset               # local: migration + seed
```
