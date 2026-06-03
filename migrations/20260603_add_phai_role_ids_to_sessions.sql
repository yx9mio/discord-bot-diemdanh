-- [A3] Add phai_role_ids column to sessions table
-- Lưu danh sách role IDs được dùng để filter member khi tính eligible_member_ids
-- Type: text[] (array of role IDs)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS phai_role_ids text[] DEFAULT NULL;

-- Comment cho document
COMMENT ON COLUMN sessions.phai_role_ids IS 'Danh sách role IDs dùng để filter thành viên khi mở phiên';
