'use strict';
// [UX-W3] Wizard tạo Bang Chiến — draft tạm giữa các bước, tự xóa sau 10 phút
const drafts = new Map();
const TTL = 10 * 60 * 1000;

function get(userId) {
  const d = drafts.get(userId);
  if (!d) return null;
  if (Date.now() - d.updatedAt > TTL) {
    drafts.delete(userId);
    return null;
  }
  return d;
}

function put(userId, draft) {
  drafts.set(userId, { ...draft, updatedAt: Date.now() });
}

function clear(userId) {
  drafts.delete(userId);
}

module.exports = { get, put, clear };