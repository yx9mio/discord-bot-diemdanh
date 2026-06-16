'use strict';
const { getClient, _throwSupabase } = require('../services/_client.js');
const log = require('./logger.js');
const { WebhookClient } = require('discord.js');

const WEBHOOK_ACTIONS = new Set([
  'OWNER_BYPASS',
  'CONFIG_UPDATE',
  'RESET_STREAK',
]);

async function sendWebhookAlert({ action, actorId, guildId, metadata }) {
  const url = process.env.DISCORD_AUDIT_WEBHOOK_URL;
  if (!url) return;
  try {
    const webhook = new WebhookClient({ url });
    await webhook.send({
      embeds: [{
        color: 0xed4245,
        title: `🔴 ${action}`,
        fields: [
          { name: 'Guild', value: guildId || 'N/A', inline: true },
          { name: 'Actor', value: `<@${actorId}>`, inline: true },
          { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
          { name: 'Metadata', value: `\`\`\`json\n${JSON.stringify(metadata, null, 2).slice(0, 1000)}\n\`\`\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    }).catch(() => {});
  } catch { }
}

async function auditLog({ guildId, actorId, action, targetId = null, metadata = {} }) {
  try {
    const payload = { guild_id: guildId, actor_id: actorId, action, target_id: targetId, metadata };
    const { error } = await getClient().from('audit_logs').insert(payload);
    if (error) log.warn('AUDIT', guildId, 'Insert thất bại: %s', error.message);
  } catch (e) {
    log.warn('AUDIT', guildId, 'Lỗi ghi audit log: %s', e.message);
  }
  if (WEBHOOK_ACTIONS.has(action)) {
    sendWebhookAlert({ action, actorId, guildId, metadata }).catch(() => {});
  }
}

async function getAuditLogs({ guildId, limit = 10, offset = 0, action = null, actions = null }) {
  try {
    let query = getClient()
      .from('audit_logs')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (action) query = query.eq('action', action);
    if (actions) query = query.in('action', actions);
    const { data, error } = await query;
    if (error) {
      log.warn('AUDIT_READ', guildId, 'Query thất bại: %s', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: data ?? [], total: (data ?? []).length };
  } catch (e) {
    log.warn('AUDIT_READ', guildId, 'Lỗi đọc audit: %s', e.message);
    return { rows: [], total: 0 };
  }
}

async function getAuditLogCount({ guildId, action = null, actions = null }) {
  try {
    let query = getClient()
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('guild_id', guildId);
    if (action) query = query.eq('action', action);
    if (actions) query = query.in('action', actions);
    const { count, error } = await query;
    if (error) {
      log.warn('AUDIT_COUNT', guildId, 'Count thất bại: %s', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    log.warn('AUDIT_COUNT', guildId, 'Lỗi đếm audit: %s', e.message);
    return 0;
  }
}

module.exports = { auditLog, getAuditLogs, getAuditLogCount };
