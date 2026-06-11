ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS phai_role_ids TEXT[] DEFAULT '{}';
