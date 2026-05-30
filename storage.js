const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve('./data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

const SessionStore = {
  all() { return readJson('sessions.json', {}); },
  get(guildId) { return this.all()[guildId] ?? null; },
  set(guildId, session) { const d = this.all(); d[guildId] = session; writeJson('sessions.json', d); },
  delete(guildId) { const d = this.all(); delete d[guildId]; writeJson('sessions.json', d); },
};

const DEFAULT_CONFIG = { allowed_role_id: null, allowed_role_name: 'Bang Chúng', admin_role_id: null, admin_role_name: 'Bang Chủ' };
const ConfigStore = {
  all() { return readJson('config.json', {}); },
  get(guildId) { return this.all()[guildId] ?? { ...DEFAULT_CONFIG }; },
  set(guildId, cfg) { const d = this.all(); d[guildId] = cfg; writeJson('config.json', d); },
};

const HistoryStore = {
  all() { return readJson('history.json', {}); },
  get(guildId) { return this.all()[guildId] ?? []; },
  push(guildId, session) { const d = this.all(); if (!d[guildId]) d[guildId] = []; d[guildId].push(session); writeJson('history.json', d); },
};

const MemberStatsStore = {
  all() { return readJson('members.json', {}); },
  get(guildId, userId) { return this.all()[guildId]?.[userId] ?? null; },
  getAll(guildId) { return this.all()[guildId] ?? {}; },
  set(guildId, userId, stats) { const d = this.all(); if (!d[guildId]) d[guildId] = {}; d[guildId][userId] = stats; writeJson('members.json', d); },
  setMany(guildId, map) { const d = this.all(); d[guildId] = { ...(d[guildId] ?? {}), ...map }; writeJson('members.json', d); },
};

module.exports = { SessionStore, ConfigStore, HistoryStore, MemberStatsStore };
