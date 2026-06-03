'use strict';
// interaction-handlers/setup/setupConfigEditSelect.js
// SelectMenu handler: xử lý ChannelSelect & RoleSelect cho cài đặt chung
const { MessageFlags } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db  = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');
const { ConfigView } = require('../../src/commands/setup/_ConfigView.js');

const SELECT_PREFIX = 'setup:cfg:select:';

const SELECT_IDS = new Set([
  SELECT_PREFIX + 'channel',
  SELECT_PREFIX + 'phai',
  SELECT_PREFIX + 'admin_role',
  SELECT_PREFIX + 'attendance_role',
]);

async function handleSelect(interaction) {
  // deferUpdate() để giữ ephemeral message, sau đó editReply để xóa component
  await interaction.deferUpdate();

  const { ok } = await requireAdmin(interaction, { context: 'chỉnh sửa cấu hình', deferred: true });
  if (!ok) return;

  const guildId  = interaction.guildId;
  const selectId = interaction.customId;
  const cfg      = await db.getGuildConfig(guildId);

  // [FIX] Hàm helper: refresh ConfigView message gốc sau khi lưu thành công
  // interaction.message là ephemeral SelectMenu reply, không phải message gốc của ConfigView.
  // ConfigView được gắn trên interaction.message.reference hoặc phải fetch qua channel.
  // Cách đơn giản nhất: lấy message gốc qua interaction.message.interaction.message (followUp flow)
  // Tuy nhiên với flow deferUpdate trên ephemeral reply, không có reference đáng tin cậy.
  // → Dùng interaction.channel để fetch pinned/last message có ConfigView embed là không reliable.
  // → Best approach: store messageId hoặc dùng interaction.message.reference.messageId nếu có.
  // → Thực tế: ephemeral SelectMenu reply KHÔNG có .message trên interaction sau deferUpdate.
  //   interaction.message ở đây là message chứa SelectMenu (ephemeral), không phải ConfigView.
  // → Cách khả thi: sau lưu xong, editReply ephemeral thành ConfigView refreshed.
  async function refreshView(newCfg) {
    const view = ConfigView.render({ cfg: newCfg, guild: interaction.guild });
    // Thay thế ephemeral message bằng ConfigView mới (user thấy ngay kết quả)
    return interaction.editReply({ ...view, content: null });
  }

  try {
    // --- Kênh thông báo (notification_channel_id) ---
    if (selectId === SELECT_PREFIX + 'channel') {
      const channelId = interaction.values[0];
      const newCfg = { ...cfg, notification_channel_id: channelId };
      await db.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật notification_channel_id = %s', channelId);
      return refreshView(newCfg);
    }

    // --- Phái (multi-role) ---
    if (selectId === SELECT_PREFIX + 'phai') {
      const roleIds = interaction.values;
      const newCfg = { ...cfg, phai_role_ids: roleIds };
      await db.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật phai_role_ids = %j', roleIds);
      return refreshView(newCfg);
    }

    // --- Role Quản lý ---
    if (selectId === SELECT_PREFIX + 'admin_role') {
      const roleId = interaction.values[0] ?? null;
      const newCfg = { ...cfg, admin_role_id: roleId };
      await db.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật admin_role_id = %s', roleId);
      return refreshView(newCfg);
    }

    // --- Role Điểm danh ---
    if (selectId === SELECT_PREFIX + 'attendance_role') {
      const roleId = interaction.values[0] ?? null;
      const newCfg = { ...cfg, attendance_role_id: roleId };
      await db.setGuildConfig(guildId, newCfg);
      log.info('SETUP_CFG', guildId, 'Cập nhật attendance_role_id = %s', roleId);
      return refreshView(newCfg);
    }

    return interaction.editReply({ content: '❌ Hành động không xác định.', components: [] });
  } catch (e) {
    log.error('SETUP_CFG', guildId, 'Lỗi cập nhật config qua select: %s', e.message);
    return interaction.editReply({ content: `❌ Không thể cập nhật: ${e.message}`, components: [] });
  }
}

class SetupConfigEditSelectHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.SelectMenu,
    });
  }

  parse(interaction) {
    if (SELECT_IDS.has(interaction.customId)) return this.some();
    return this.none();
  }

  async run(interaction) {
    return handleSelect(interaction);
  }
}

module.exports = SetupConfigEditSelectHandler;
