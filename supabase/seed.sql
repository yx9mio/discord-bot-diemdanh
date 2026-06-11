-- seed.sql — Sample data for local development
-- Run: supabase db reset (or npx supabase db reset)
-- All IDs are fake UUIDs — replace guild/user IDs with real Discord IDs for testing.

-- ── Guild config ──────────────────────────────────────────────────────────────
INSERT INTO guild_configs (guild_id, timezone, admin_role_id, attendance_role_id, phai_role_ids, phai_role_icons)
VALUES (
  '123456789012345678',
  'Asia/Ho_Chi_Minh',
  '222222222222222222',
  '333333333333333333',
  ARRAY['444444444444444444', '555555555555555555'],
  '{"444444444444444444": "⚔️", "555555555555555555": "🛡️"}'::jsonb
) ON CONFLICT (guild_id) DO NOTHING;

-- ── Members ───────────────────────────────────────────────────────────────────
INSERT INTO members (guild_id, user_id, username, phong_ban) VALUES
  ('123456789012345678', '100000000000000001', 'Nguyen Van A',    'Dev'),
  ('123456789012345678', '100000000000000002', 'Tran Thi B',      'Dev'),
  ('123456789012345678', '100000000000000003', 'Le Van C',        'Design'),
  ('123456789012345678', '100000000000000004', 'Pham Thi D',      'Design'),
  ('123456789012345678', '100000000000000005', 'Hoang Van E',     'Marketing'),
  ('123456789012345678', '100000000000000006', 'Ngo Thi F',       'Marketing'),
  ('123456789012345678', '100000000000000007', 'Dang Van G',      'Dev'),
  ('123456789012345678', '100000000000000008', 'Vu Thi H',        'Design'),
  ('123456789012345678', '100000000000000009', 'Bui Van I',       NULL),
  ('123456789012345678', '100000000000000010', 'Lam Thi K',       NULL)
ON CONFLICT (guild_id, user_id) DO NOTHING;

-- ── Sessions (2 closed + 1 active) ────────────────────────────────────────────
INSERT INTO sessions (id, guild_id, session_name, started_by, is_active, cancelled, channel_id, message_id, started_at, ended_at)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '123456789012345678',
    'Điểm danh sáng 01/06',
    '100000000000000001',
    false, false,
    '900000000000000001', '800000000000000001',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days' + INTERVAL '1 hour'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '123456789012345678',
    'Điểm danh chiều 01/06',
    '100000000000000001',
    false, false,
    '900000000000000002', '800000000000000002',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '45 minutes'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '123456789012345678',
    'Điểm danh hôm nay',
    '100000000000000002',
    true, false,
    '900000000000000003', '800000000000000003',
    NOW() - INTERVAL '10 minutes',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ── Attendances ───────────────────────────────────────────────────────────────
-- Session 1: 6/8 điểm danh
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000001', 'Nguyen Van A',  'tham_gia',       '100000000000000001', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000001');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000002', 'Tran Thi B',    'tham_gia',       '100000000000000002', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000002');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000003', 'Le Van C',      'tre',            '100000000000000003', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000003');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000004', 'Pham Thi D',    'co_phep',        '100000000000000004', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000004');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000005', 'Hoang Van E',   'tham_gia',       '100000000000000005', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000005');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000001', '123456789012345678', '100000000000000006', 'Ngo Thi F',     'khong_tham_gia', '100000000000000006', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000001' AND user_id = '100000000000000006');

-- Session 2: 5/8 điểm danh
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000002', '123456789012345678', '100000000000000001', 'Nguyen Van A',  'tham_gia',       '100000000000000001', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000002' AND user_id = '100000000000000001');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000002', '123456789012345678', '100000000000000002', 'Tran Thi B',    'tham_gia',       '100000000000000002', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000002' AND user_id = '100000000000000002');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000002', '123456789012345678', '100000000000000003', 'Le Van C',      'tham_gia',       '100000000000000003', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000002' AND user_id = '100000000000000003');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000002', '123456789012345678', '100000000000000008', 'Vu Thi H',      'tham_gia',       '100000000000000008', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000002' AND user_id = '100000000000000008');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000002', '123456789012345678', '100000000000000009', 'Bui Van I',     'tham_gia',       '100000000000000009', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000002' AND user_id = '100000000000000009');

-- Session 3 (active): 2/10 đã điểm danh
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000003', '123456789012345678', '100000000000000001', 'Nguyen Van A',  'tham_gia',       '100000000000000001', NOW() - INTERVAL '5 minutes'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000003' AND user_id = '100000000000000001');
INSERT INTO attendances (session_id, guild_id, user_id, username, status, marked_by, checked_in_at)
SELECT 'a0000000-0000-0000-0000-000000000003', '123456789012345678', '100000000000000002', 'Tran Thi B',    'tre',            '100000000000000002', NOW() - INTERVAL '3 minutes'
WHERE NOT EXISTS (SELECT 1 FROM attendances WHERE session_id = 'a0000000-0000-0000-0000-000000000003' AND user_id = '100000000000000002');

-- ── Member stats ──────────────────────────────────────────────────────────────
INSERT INTO member_stats (guild_id, user_id, current_streak, best_streak, total_joined, total_sessions, total_late, total_excused, total_absent, last_session_id, last_attended_at)
VALUES
  ('123456789012345678', '100000000000000001', 3, 10, 20, 22, 1, 0, 1, 'a0000000-0000-0000-0000-000000000003', NOW()),
  ('123456789012345678', '100000000000000002', 2, 8,  18, 22, 2, 1, 1, 'a0000000-0000-0000-0000-000000000003', NOW()),
  ('123456789012345678', '100000000000000003', 1, 5,  15, 22, 4, 2, 1, 'a0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '1 day'),
  ('123456789012345678', '100000000000000004', 0, 3,  10, 22, 1, 5, 6, NULL, NOW() - INTERVAL '2 days'),
  ('123456789012345678', '100000000000000005', 5, 12, 22, 22, 0, 0, 0, 'a0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '2 days')
ON CONFLICT (guild_id, user_id) DO NOTHING;

-- ── Scheduled session template ────────────────────────────────────────────────
INSERT INTO scheduled_sessions (guild_id, channel_id, session_name, day_of_week, hour, minute, allowed_role_id, phai_role_ids)
VALUES (
  '123456789012345678',
  '900000000000000001',
  'Điểm danh sáng',
  2,  -- Tuesday
  8,  -- 08:00
  0,
  '333333333333333333',
  ARRAY['444444444444444444', '555555555555555555']
) ON CONFLICT (id) DO NOTHING;
