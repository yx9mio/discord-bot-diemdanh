ALTER TABLE guild_configs
ADD COLUMN IF NOT EXISTS admin_role_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attendance_role_id TEXT DEFAULT NULL;

COMMENT ON COLUMN guild_configs.admin_role_id IS 'Role được quyền quản lý bot (thay thế/vượt qua ManageGuild)';
COMMENT ON COLUMN guild_configs.attendance_role_id IS 'Role bắt buộc để điểm danh — nếu null thì ai cũng điểm danh được';
