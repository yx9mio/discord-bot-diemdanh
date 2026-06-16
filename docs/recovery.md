# Recovery Runbook

## DB chết (Supabase outage / corrupt data)

```
1. Pause bot (disable PM2 / Docker)
2. Verify outage — check Supabase status page
3. If corrupt: restore from latest backup
   3a. Supabase Dashboard → Database → Backups → Restore
   3b. Or manual: psql -d "$DATABASE_URL" < backup.sql
4. Verify data integrity:
    □ sessions — count, latest 5 non-cancelled
    □ scheduled_sessions — count, next due
    □ members — count, sample spot-check
    □ guild_configs — all guilds present
    □ audit_logs — recent entries readable
5. Reset scheduler lock:
    DELETE FROM scheduler_lock WHERE lock_name = 'scheduler_leader';
6. Resume bot
7. Verify scheduler tick runs (check logs for "Sent Xmin reminder")
```

## Discord webhook / notification channel chết

```
1. Check audit webhook: DISCORD_AUDIT_WEBHOOK_URL
   1a. Navigate to Server Settings → Integrations → Webhooks
   1b. Rotate URL if compromised
   1c. Update env var, redeploy
2. Check notification channel per guild:
   2a. /setup → Cài Đặt → verify channel selector
   2b. If deleted: set new channel in config
3. Test audit logging after fix
    □ Perform any admin action (e.g. open session)
    □ Verify audit entry appears in 📜 Log view
```

## Service role leak (Supabase anon/service key exposed)

```
1. Rotate key immediately:
    Supabase Dashboard → Settings → API → Service Role → Regenerate
2. Update DATABASE_URL / SUPABASE_SERVICE_KEY in env
3. Redeploy bot
4. Verify DB access:
    □ Query works: SELECT count(*) FROM sessions;
    □ Insert works: INSERT INTO audit_logs ...;
5. Check audit logs for unauthorized access (guild_id mismatch pattern)
```

## Bot crash / unresponsive

```
1. Check logs: pm2 logs discord-bot (or docker logs)
2. If OOM: increase memory limit, check for memory leaks
3. If loop: check scheduler lock heartbeat
    SELECT * FROM scheduler_lock;
    If stale (older than 30s), DELETE and restart
4. Restart: pm2 restart discord-bot
5. Verify all guilds recover:
    □ Scheduler tick runs
    □ Buttons respond
    □ Audit logs write
```

## Cold start (new instance / migration)

```
1. Set env vars (see .env.example)
2. npm install --production
3. Run DB migration if any:
    supabase migration up (or manual SQL)
4. Start bot
5. Verify:
    □ Login successful (no Discord token errors)
    □ Scheduler starts: "Reminder scheduler started"
    □ Dashboard loads: /setup
    □ Active sessions restore (check message_id references)
    □ Auto-refresh timers attach to existing messages
```

## Data loss — partial (accidental delete)

```
1. STOP BOT IMMEDIATELY
2. Identify scope:
    □ Single guild? → restore from backup
    □ All guilds? → full DB restore
    □ Recent only? → check audit logs for DELETE actions
3. Restore specific table from backup:
    pg_restore --data-only -t sessions -d "$DATABASE_URL" backup.dump
4. Verify affected guilds
5. Resume bot
```

## Scheduler lock stuck

```
Symptom: "Previous tick still running" in logs every minute.
Cause: Previous tick crashed without releasing lock.

Fix:
    DELETE FROM scheduler_lock WHERE lock_name = 'scheduler_leader';
    Restart bot (or wait up to 30s — heartbeat timeout releases it).
```

## Key contacts / links

| Resource | Location |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard |
| Hosting (VPS) | pm2/docker host SSH |
| Env vars | .env (local), server env manager |
| Audit webhook | Discord server settings |
| GitHub repo | `git remote -v` |
