// ─── In-Memory Storage (WispByte / ephemeral environments) ───────────────────
// Dữ liệu tồn tại trong RAM — mất khi bot restart.
// Để persistent: dùng Supabase/PostgreSQL thay thế các store bên dưới.

const _sessions  = {}; // { [guildId]: Session }
const _configs   = {}; // { [guildId]: Config  }
const _history   = {}; // { [guildId]: Session[] }
const _members   = {}; // { [guildId]: { [userId]: Stats } }

const DEFAULT_CONFIG = {
  allowed_role_id:   null,
  allowed_role_name: 'Bang Chúng',
  admin_role_id:     null,
  admin_role_name:   'Bang Chủ',
};

const SessionStore = {
  all()                  { return { ..._sessions }; },
  get(guildId)           { return _sessions[guildId] ?? null; },
  set(guildId, session)  { _sessions[guildId] = session; },
  delete(guildId)        { delete _sessions[guildId]; },
};

const ConfigStore = {
  all()              { return { ..._configs }; },
  get(guildId)       { return _configs[guildId] ?? { ...DEFAULT_CONFIG }; },
  set(guildId, cfg)  { _configs[guildId] = cfg; },
};

const HistoryStore = {
  all()                    { return { ..._history }; },
  get(guildId)             { return _history[guildId] ?? []; },
  push(guildId, session)   {
    if (!_history[guildId]) _history[guildId] = [];
    _history[guildId].push(session);
  },
};

const MemberStatsStore = {
  all()                          { return { ..._members }; },
  get(guildId, userId)           { return _members[guildId]?.[userId] ?? null; },
  getAll(guildId)                { return _members[guildId] ?? {}; },
  set(guildId, userId, stats)    {
    if (!_members[guildId]) _members[guildId] = {};
    _members[guildId][userId] = stats;
  },
  setMany(guildId, map)          {
    _members[guildId] = { ...(_members[guildId] ?? {}), ...map };
  },
};

module.exports = { SessionStore, ConfigStore, HistoryStore, MemberStatsStore };
