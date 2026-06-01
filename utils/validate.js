// utils/validate.js — Zod schemas cho các object quan trọng
// Dùng để validate data từ DB trước khi đưa vào scheduler / session logic
'use strict';
const { z } = require('zod');

// ─── Scheduled session (lịch cố định) ────────────────────────────────────────
const LichSchema = z.object({
  id:                z.string().uuid(),
  guild_id:          z.string().min(1),
  channel_id:        z.string().min(1),
  session_name:      z.string().min(1).max(100),
  day_of_week:       z.number().int().min(0).max(6),
  hour:              z.number().int().min(0).max(23),
  minute:            z.number().int().min(0).max(59),
  close_day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  close_hour:        z.number().int().min(0).max(23).nullable().optional(),
  close_minute:      z.number().int().min(0).max(59).nullable().optional(),
  allowed_role_id:   z.string().nullable().optional(),
  phai_role_ids:     z.array(z.string()).nullable().optional(),
  is_active:         z.boolean().optional(),
});

// ─── Session row (từ DB) ──────────────────────────────────────────────────────
const SessionSchema = z.object({
  id:                   z.string().uuid(),
  guild_id:             z.string().min(1),
  session_name:         z.string().min(1),
  started_by:           z.string().min(1),
  is_active:            z.boolean(),
  cancelled:            z.boolean().optional().default(false),
  channel_id:           z.string().nullable().optional(),
  message_id:           z.string().nullable().optional(),
  eligible_member_ids:  z.array(z.string()).nullable().optional(),
  allowed_role_id:      z.string().nullable().optional(),
  auto_close_at:        z.string().datetime().nullable().optional(),
  created_at:           z.string().datetime().optional(),
  ended_at:             z.string().datetime().nullable().optional(),
});

// ─── Attendance row ───────────────────────────────────────────────────────────
const AttendanceSchema = z.object({
  id:            z.string().uuid().optional(),
  session_id:    z.string().uuid(),
  guild_id:      z.string().optional(),
  user_id:       z.string().min(1),
  username:      z.string().nullable().optional(),
  status:        z.enum(['tham_gia', 'tre', 'khong_tham_gia', 'co_phep']),
  marked_by:     z.string().nullable().optional(),
  checked_in_at: z.string().datetime().nullable().optional(),
});

// ─── Guild config ─────────────────────────────────────────────────────────────
const ConfigSchema = z.object({
  guild_id:        z.string().min(1),
  log_channel_id:  z.string().nullable().optional(),
  admin_role_id:   z.string().nullable().optional(),
  default_role_id: z.string().nullable().optional(),
});

/**
 * Parse + validate an toàn — trả về { ok, data } thay vì throw.
 * Dùng trong scheduler để bỏ qua lịch bị broken thay vì crash toàn bộ.
 *
 * @template T
 * @param {import('zod').ZodSchema<T>} schema
 * @param {unknown} input
 * @returns {{ ok: true, data: T } | { ok: false, error: string }}
 */
function safeParse(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return { ok: false, error: msg };
}

module.exports = { LichSchema, SessionSchema, AttendanceSchema, ConfigSchema, safeParse };
