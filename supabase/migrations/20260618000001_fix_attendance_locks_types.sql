-- Fix attendance_locks column types: bigint → uuid/text to match sessions.id and attendances.user_id
-- The original migration used bigint which causes "invalid input syntax for type bigint" errors
-- when inserting UUID session IDs and Discord snowflake user IDs.
ALTER TABLE attendance_locks
  ALTER COLUMN session_id TYPE uuid USING session_id::uuid,
  ALTER COLUMN user_id    TYPE text;
