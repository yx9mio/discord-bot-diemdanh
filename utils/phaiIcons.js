// utils/phaiIcons.js — Supabase Storage helper cho icon phái (hình ảnh)
'use strict';
const { getClient } = require('../services/_client.js');
const log = require('./logger.js');

const BUCKET = 'phai-icons';
const SUPPORTED_EXTS = ['png', 'gif', 'webp'];

// cache: roleId → URL (tránh gọi Supabase liên tục)
const _urlCache = new Map();

function _getSupabaseUrl() {
  // Lấy từ env; fallback parse từ SUPABASE_URL nếu có
  return process.env.SUPABASE_URL?.replace(/\/+$/, '') ?? '';
}

function buildPublicUrl(guildId, roleId, ext = 'png') {
  const base = _getSupabaseUrl();
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${guildId}/${roleId}.${ext}`;
}

async function getPhaiIconUrl(guildId, roleId) {
  const cacheKey = `${guildId}:${roleId}`;
  if (_urlCache.has(cacheKey)) return _urlCache.get(cacheKey);

  const client = getClient();
  // Thử các extension phổ biến
  for (const ext of SUPPORTED_EXTS) {
    const path = `${guildId}/${roleId}.${ext}`;
    const { data } = await client.storage.from(BUCKET).list(`${guildId}`, {
      limit: 1,
      search: `${roleId}.${ext}`,
    });
    if (data?.length > 0) {
      const url = buildPublicUrl(guildId, roleId, ext);
      if (url) _urlCache.set(cacheKey, url);
      return url ?? null;
    }
  }
  return null;
}

async function getFirstPhaiIconUrl(guildId, phaiRoleIds = []) {
  for (const roleId of phaiRoleIds) {
    const url = await getPhaiIconUrl(guildId, roleId).catch(() => null);
    if (url) return url;
  }
  return null;
}

function clearCache() { _urlCache.clear(); }

module.exports = { getPhaiIconUrl, getFirstPhaiIconUrl, buildPublicUrl, clearCache };
