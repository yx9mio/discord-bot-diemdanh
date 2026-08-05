-- 20260805000001_add_missing_members_phai_columns.sql
-- members.phai_role_ids được dùng trong code (memberService.upsertMember/getMemberStats/
-- getTopMembers) để gán và lọc phái theo từng thành viên, nhưng chưa từng được định
-- nghĩa trong migration nào. Thêm để khớp schema với code (idempotent).
ALTER TABLE members ADD COLUMN IF NOT EXISTS phai_role_ids TEXT[] DEFAULT '{}';
