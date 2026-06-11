ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS phai_role_ids TEXT[] DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guild_configs_phai_update') THEN
    ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;
