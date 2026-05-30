// storage.js — JSON file storage (CommonJS)
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  sessions: path.join(DATA_DIR, 'sessions.json'),
  history:  path.join(DATA_DIR, 'history.json'),
  config:   path.join(DATA_DIR, 'config.json'),
  members:  path.join(DATA_DIR, 'members.json'),
};

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return {}; }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Session ──────────────────────────────────────────────────
function getSession(guildId) {
  const s = read(FILES.sessions);
  return s[guildId] ?? null;
}

function createSession(guildId, data) {
  const s = read(FILES.sessions);
  s[guildId] = data;
  write(FILES.sessions, s);
  return data;
}

function cancelSession(guildId) {
  const s = read(FILES.sessions);
  delete s[guildId];
  write(FILES.sessions, s);
}

function endSession(guildId) {
  const s = read(FILES.sessions);
  const session = s[guildId];
  if (!session) return;

  // Save to history
  const h = read(FILES.history);
  if (!h[guildId]) h[guildId] = [];
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter(x => x.status === 'tham_gia');
  const declined = attendees.filter(x => x.status === 'khong_tham_gia');
  h[guildId].push({
    session_name: session.session_name,
    start_time: session.start_time,
    total_tham_gia: joined.length,
    total_khong_tham_gia: declined.length,
    eligible_count: session.eligible_member_ids.length,
    attendees_joined: joined.map(x => x.name),
  });
  write(FILES.history, h);

  delete s[guildId];
  write(FILES.sessions, s);
}

function setAttendee(guildId, userId, data) {
  const s = read(FILES.sessions);
  if (!s[guildId]) return;
  s[guildId].attendees[userId] = data;
  write(FILES.sessions, s);
}

function removeAttendee(guildId, userId) {
  const s = read(FILES.sessions);
  if (!s[guildId]) return;
  delete s[guildId].attendees[userId];
  write(FILES.sessions, s);
}

// ─── History ─────────────────────────────────────────────────
function getHistory(guildId) {
  const h = read(FILES.history);
  return h[guildId] ?? [];
}

// ─── Config ──────────────────────────────────────────────────
function getConfig(guildId) {
  const c = read(FILES.config);
  return c[guildId] ?? {
    allowed_role_id: null, allowed_role_name: 'BangMember',
    admin_role_id: null,   admin_role_name: 'BangAdmin',
  };
}

function setConfig(guildId, updates) {
  const c = read(FILES.config);
  c[guildId] = { ...getConfig(guildId), ...updates };
  write(FILES.config, c);
}

// ─── Member Stats ─────────────────────────────────────────────
function getMemberStats(guildId, userId) {
  const m = read(FILES.members);
  if (!m[guildId]) m[guildId] = {};
  return m[guildId][userId] ?? { total: 0, eligible: 0, streak: 0, last_session: null };
}

function getAllMemberStats(guildId) {
  const m = read(FILES.members);
  return m[guildId] ?? {};
}

function updateMemberStats(guildId, userId, joined) {
  const m = read(FILES.members);
  if (!m[guildId]) m[guildId] = {};
  const s = m[guildId][userId] ?? { total: 0, eligible: 0, streak: 0, last_session: null };
  s.eligible++;
  if (joined) {
    s.total++;
    s.streak++;
  } else {
    s.streak = 0;
  }
  s.last_session = new Date().toISOString();
  m[guildId][userId] = s;
  write(FILES.members, m);
}

module.exports = {
  getSession, createSession, cancelSession, endSession,
  setAttendee, removeAttendee,
  getHistory,
  getConfig, setConfig,
  getMemberStats, getAllMemberStats, updateMemberStats,
};
