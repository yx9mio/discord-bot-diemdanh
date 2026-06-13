-- Refresh PostgREST schema cache so the newly added `type` column
-- (added in 20260614000002) is immediately visible to the REST API.
NOTIFY pgrst, 'reload schema';
