'use strict';
const { getClient, _throwSupabase } = require('./_client.js');
const log = require('../utils/logger.js');

// In-memory cache: Map<"guildId:emojiName", "<:name:id>" | "<a:name:id>">
const _cache = new Map();
function _key(guildId, name) { return `${guildId}:${name}`; }

/** Xoá toàn bộ cache trong memory cho guild */
function _clearGuild(guildId) {
  for (const k of _cache.keys()) {
    if (k.startsWith(guildId + ':')) _cache.delete(k);
  }
}

function _set(guildId, name, emojiString) {
  _cache.set(_key(guildId, name), emojiString);
}
function _del(guildId, name) { _cache.delete(_key(guildId, name)); }

/** Đồng bộ emoji từ Discord guild.emojis.cache → Supabase + in-memory cache */
async function syncGuildEmojis(guild) {
  if (!guild?.emojis?.cache) return;
  const emojis = guild.emojis.cache.map(e => ({
    guild_id: guild.id,
    emoji_id: e.id,
    emoji_name: e.name,
    animated: e.animated ?? false,
  }));
  if (!emojis.length) { _clearGuild(guild.id); return; }

  // Ghi đè toàn bộ emoji của guild trong Supabase (delete + insert)
  const client = getClient();
  const { error: delErr } = await client.from('guild_emojis').delete().eq('guild_id', guild.id);
  _throwSupabase(delErr, 'syncGuildEmojis.delete');
  const { error: insErr } = await client.from('guild_emojis').insert(emojis);
  _throwSupabase(insErr, 'syncGuildEmojis.insert');

  // Cập nhật in-memory cache
  _clearGuild(guild.id);
  for (const e of emojis) {
    const str = e.animated ? `<a:${e.emoji_name}:${e.emoji_id}>` : `<:${e.emoji_name}:${e.emoji_id}>`;
    _set(guild.id, e.emoji_name, str);
  }

  log.info('EMOJI_CACHE', guild.id, 'Synced %d emojis to Supabase', emojis.length);
}

/** Đồng bộ một emoji (create / update) — upsert vào Supabase + update memory */
async function upsertEmoji(emoji) {
  if (!emoji?.guild?.id || !emoji?.id || !emoji?.name) return;
  const guildId = emoji.guild.id;
  const client = getClient();
  const { error } = await client.from('guild_emojis').upsert({
    guild_id: guildId,
    emoji_id: emoji.id,
    emoji_name: emoji.name,
    animated: emoji.animated ?? false,
  }, { onConflict: 'guild_id,emoji_id' });
  _throwSupabase(error, 'upsertEmoji');

  const str = (emoji.animated ?? false) ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
  _set(guildId, emoji.name, str);
  log.debug('EMOJI_CACHE', guildId, 'Upserted emoji %s (%s)', emoji.name, emoji.id);
}

/** Xoá một emoji khỏi Supabase + memory */
async function deleteEmoji(emoji) {
  if (!emoji?.guild?.id || !emoji?.id) return;
  const guildId = emoji.guild.id;
  const client = getClient();
  const { error } = await client.from('guild_emojis').delete().eq('guild_id', guildId).eq('emoji_id', emoji.id);
  _throwSupabase(error, 'deleteEmoji');

  _del(guildId, emoji.name);
  log.debug('EMOJI_CACHE', guildId, 'Deleted emoji %s (%s)', emoji.name, emoji.id);
}

/** Load emoji cache từ Supabase vào memory (dùng khi bot start) */
async function loadGuildEmojiCache(guildId) {
  const client = getClient();
  const { data, error } = await client.from('guild_emojis').select('emoji_name, emoji_id, animated').eq('guild_id', guildId);
  _throwSupabase(error, 'loadGuildEmojiCache');

  _clearGuild(guildId);
  if (!data?.length) return;
  for (const e of data) {
    const str = e.animated ? `<a:${e.emoji_name}:${e.emoji_id}>` : `<:${e.emoji_name}:${e.emoji_id}>`;
    _set(guildId, e.emoji_name, str);
  }
  log.info('EMOJI_CACHE', guildId, 'Loaded %d emojis from Supabase cache', data.length);
}

/** Tra cứu emoji string từ in-memory cache (synchronous) */
function getEmojiString(guildId, name) {
  return _cache.get(_key(guildId, name)) ?? null;
}

module.exports = {
  syncGuildEmojis, upsertEmoji, deleteEmoji, loadGuildEmojiCache, getEmojiString,
};