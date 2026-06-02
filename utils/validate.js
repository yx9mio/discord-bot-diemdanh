// utils/validate.js — Zod schemas cho các object quan trọng
'use strict';
const { z }                       = require('zod');
const { fromZodError }            = require('zod-validation-error');

// ─── Scheduled session (lịch cố định) ────────────────────────────────────────
const LichSchema = z.object({
  id:                 z.string().uuid(),
  guild_id:           z.string().min(1),
  channel_id:         z.string().min(1),
  session_name:       z.string().min(1).max(100),
  day_of_week:        z.number().int().min(0).max(6),
  hour:               z.number().int().min(0).max(23),
  minute:             z.number().int().min(0).max(59),
  close_day_of_week:  z.number().int().min(0).max(6).nullable().optional(),
  close_hour:         z.number().int().min(0).max(23).nullable().optional(),
  close_minute:       z.number().int().min(0).max(59).nullable().optional(),
  pre_close_minutes:  z.number().int().min(0).max(180).optional().default(30),
  allowed_role_id:    z.string().nullable().optional(),
  phai_role_ids:      z.array(z.string()).nullable().optional(),
  is_active:          z.boolean().optional(),
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
  status:        z.enum(['tham_gia', 'tre', 'khong_tham_gia', 'co_phep']).optional(),
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

// ─── Slash command inputs ─────────────────────────────────────────────────────
const BatDauInputSchema = z.object({
  session_name:        z.string().min(1).max(100),
  allowed_role_id:     z.string().nullable().optional(),
  eligible_member_ids: z.array(z.string()).nullable().optional(),
});

const CaiDatInputSchema = z.object({
  log_channel_id:  z.string().nullable().optional(),
  admin_role_id:   z.string().nullable().optional(),
  default_role_id: z.string().nullable().optional(),
});

/**
 * Parse + validate an toàn — trả về { ok, data } thay vì throw.
 * Error message được format bởi zod-validation-error: human-readable 1 dòng.
 * @template T
 * @param {import('zod').ZodSchema<T>} schema
 * @param {unknown} input
 * @returns {{ ok: true, data: T } | { ok: false, error: string }}
 */
function safeParse(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: fromZodError(result.error).message };
}

module.exports = {
  LichSchema, SessionSchema, AttendanceSchema, ConfigSchema,
  BatDauInputSchema, CaiDatInputSchema,
  safeParse,
};
