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
  } catch { /* webhook not configured */ }
}

async function auditLog({ guildId, actorId, action, targetId = null, metadata = {} }) {
  try {
    const payload = {
      guild_id: guildId,
      actor_id: actorId,
      action,
      target_id: targetId,
      metadata,
    };
    const { error } = await getClient()
      .from('audit_logs')
      .insert(payload);
    if (error) log.warn('AUDIT', guildId, 'Insert thất bại: %s', error.message);
  } catch (e) {
    log.warn('AUDIT', guildId, 'Lỗi ghi audit log: %s', e.message);
  }

  if (WEBHOOK_ACTIONS.has(action)) {
    sendWebhookAlert({ action, actorId, guildId, metadata }).catch(() => {});
  }
}

module.exports = { auditLog };
