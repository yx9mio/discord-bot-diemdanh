-- [A2] Add PostgreSQL advisory lock functions for distributed attendance lock
-- Thay thế in-memory lock bằng distributed lock dùng PostgreSQL advisory locks
-- pg_try_advisory_lock(key1, key2): thử lấy lock, trả về true/false
-- pg_advisory_unlock(key1, key2): giải phóng lock, trả về true/false

CREATE OR REPLACE FUNCTION try_advisory_lock(key1 bigint, key2 bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_try_advisory_lock(key1, key2);
END;
$$;

CREATE OR REPLACE FUNCTION advisory_unlock(key1 bigint, key2 bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_advisory_unlock(key1, key2);
END;
$$;

COMMENT ON FUNCTION try_advisory_lock IS 'Thử lấy advisory lock cho attendance, trả về true nếu thành công';
COMMENT ON FUNCTION advisory_unlock IS 'Giải phóng advisory lock, trả về true nếu lock đã được giải phóng';
