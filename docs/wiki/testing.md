# Testing

## Stack

- **Vitest v3**, `environment: node`, `globals: true`
- Config: `vitest.config.js`

## Chạy

```bash
npm run lint            # eslint (toàn repo, phải exit 0)
npm test                # vitest run (toàn bộ tests/)
npm run test:ci         # bộ suites ổn định cho CI (68 tests)
npm run test:watch      # watch mode
```

## Các suite ổn định (CI gate)

Chỉ chạy những suite **không phụ thuộc DB mock CJS** — vì vitest v3 không intercept
`require()` nội bộ của CJS chain `services/*.js → _client.js → @supabase/supabase-js`,
nên `vi.mock('../services/_client.js')` không hiệu lực với các service test đó
(đây là giới hạn đã biết, không phải regression).

| Suite | Tests | Mô tả |
|---|---|---|
| `cooldown.test.mjs` | 5 | cooldown logic |
| `views.test.mjs` | 21 | session/rank/summary views |
| `csvHelper.test.mjs` | 7 | export CSV |
| `designTokens.test.mjs` | 8 | design tokens |
| `sessionLogic.test.mjs` | 15 | pure `computeSessionPatches` (extracted để test được) |
| `schemaDrift.test.mjs` | 12 | parse migrations ↔ code refs |

**Lưu ý:** các suite còn lại (`attendanceService`, `sessionService`, `scheduleService`,
`memberService`, `auditLog`, `helpers`, `schedulerLock`) **fail ở baseline** vì giới hạn
CJS mocking nói trên — chúng thực sự gọi Supabase thật qua `.env`. Không xem là red flag CI.

## Schema drift test

`schemaDrift.test.mjs`:
- Đọc tất cả `supabase/migrations/*.sql`, parse thành schema map (table → columns, PK, type)
- Quét `services/*.js` + `utils/*.js` cho `.from('table')`, `.select()`, `.eq()`, `onConflict`, `.rpc()`
- Assert: mọi table/column/RPC code dùng đều tồn tại trong migrations
- Assert cứng: `attendance_locks` composite PK + type `uuid`/`text` (chống tái phát bug P1.1)

Test này đã bắt được 1 drift thật: `members.phai_role_ids` — code dùng nhưng schema không có
→ đã fix bằng migration `20260805000001_add_missing_members_phai_columns.sql`.

## CI

`.github/workflows/ci.yml` — trên push/PR: `npm ci` → `npm run lint` → `npm run test:ci`.
Không cần `.env`/Supabase trong CI.
