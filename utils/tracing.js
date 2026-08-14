// utils/tracing.js — Theo dõi transaction span theo từng interaction (slash command).
// Sapphire không có event "end handler" chung cho mọi interaction, nên dùng
// WeakMap<interaction, span> để bắt đầu span ở PreChatInputCommandRun và kết thúc
// ở ChatInputCommandFinish / ChatInputCommandError / ChatInputCommandDenied.
'use strict';

let _Sentry = null;
const spans = new WeakMap();
const startedAt = new WeakMap();

function _load() {
  if (!_Sentry) {
    try {
      _Sentry = require('@sentry/node');
    } catch {
      _Sentry = null;
    }
  }
  return _Sentry;
}

function _enabled() {
  const Sentry = _load();
  return Sentry && !!(Sentry.getClient && Sentry.getClient());
}

/**
 * Bắt đầu span cho một interaction (gọi ở PreChatInputCommandRun).
 * Chỉ tạo span khi Sentry đã init (DSN có).
 */
function begin(interaction) {
  const Sentry = _load();
  if (!Sentry || !_enabled() || !interaction) return;

  const command = interaction.commandName ?? 'unknown';
  const gid = interaction.guild?.id ?? interaction.guildId;
  const uid = interaction.user?.id ?? interaction.member?.id;

  const span = Sentry.startInactiveSpan({
    op: 'chat.command',
    name: command,
  });
  if (!span) return;
  span.setAttribute('command', command);
  if (gid) span.setAttribute('guild_id', gid);
  if (uid) span.setAttribute('user_id', uid);
  if (interaction.id) span.setAttribute('interaction_id', interaction.id);

  spans.set(interaction, span);
  startedAt.set(interaction, Date.now());
}

/**
 * Kết thúc span của interaction (gọi ở ChatInputCommandFinish / Error / Denied).
 * Idempotent — chỉ kết thúc 1 lần. `status`: 'ok' | 'error'.
 */
function finish(interaction, status = 'ok') {
  const Sentry = _load();
  const span = interaction ? spans.get(interaction) : null;
  if (!Sentry || !span) return;

  spans.delete(interaction);

  const ms = startedAt.get(interaction);
  if (ms) {
    startedAt.delete(interaction);
    try {
      const m = Sentry.metrics;
      m.distribution('bot.command.duration_ms', Date.now() - ms, { tags: [`command:${interaction.commandName ?? 'unknown'}`] });
    } catch { /* metrics không khả dụng */ }
  }

  if (status === 'error') {
    Sentry.setHttpStatus(span, 500);
  }
  span.end();
}

module.exports = { begin, finish };
