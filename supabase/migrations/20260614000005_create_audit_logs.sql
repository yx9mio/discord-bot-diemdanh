create table audit_logs (
  id bigint generated always as identity primary key,
  guild_id text,
  actor_id text not null,
  action text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_guild_idx  on audit_logs(guild_id, created_at desc);
create index audit_logs_actor_idx  on audit_logs(actor_id, created_at desc);
create index audit_logs_action_idx on audit_logs(action, created_at desc);

-- Service role access
alter table audit_logs enable row level security;

create policy "service_role_all"
  on audit_logs
  for all
  to service_role
  using (true)
  with check (true);
