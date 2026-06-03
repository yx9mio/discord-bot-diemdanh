'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const db = require('../../db.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const EDIT_MODAL_PREFIX = 'setup:mem:edit:modal:';

async function openEditMemberModal(interaction) {
  const userId = interaction.customId.slice('setup:mem:edit:'.length);
  const guildId = interaction.guildId;

  const members = await db.getMembers(guildId);
  const member = members.find(m => m.user_id === userId);
  if (!member) {
    return interaction.reply({ content: '❌ Không tìm thấy thành viên này.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(EDIT_MODAL_PREFIX + userId)
    .setTitle('Sửa thông tin thành viên')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('phong_ban')
          .setLabel('Phòng ban')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(member.phong_ban ?? ''),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ghi_chu')
          .setLabel('Ghi chú')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setValue(member.ghi_chu ?? ''),
      ),
    );
  return interaction.showModal(modal);
}

async function handleEditMemberModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'sửa thông tin thành viên', deferred: true });
  if (!ok) return;

  const userId = interaction.customId.slice(EDIT_MODAL_PREFIX.length);
  const guildId = interaction.guildId;
  const phongBan = interaction.fields.getTextInputValue('phong_ban').trim() || null;
  const ghiChu = interaction.fields.getTextInputValue('ghi_chu').trim() || null;

  try {
    await db.upsertMember({ guildId, userId, phongBan, ghiChu });
    log.info('SETUP_MEM_EDIT', guildId, 'Sửa thành viên %s: phong_ban=%s, ghi_chu=%s', userId, phongBan, ghiChu);
    return interaction.editReply({ content: `✅ Đã cập nhật thông tin <@${userId}>.` });
  } catch (e) {
    log.error('SETUP_MEM_EDIT', guildId, 'Sửa thành viên thất bại: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể sửa thông tin, thử lại sau.' });
  }
}

class SetupMemEditHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith('setup:mem:edit:')) return this.some();
    return this.none();
  }

  run(interaction) {
    return openEditMemberModal(interaction);
  }
}

class SetupMemEditModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId?.startsWith(EDIT_MODAL_PREFIX)) return this.some();
    return this.none();
  }

  run(interaction) {
    return handleEditMemberModal(interaction);
  }
}

module.exports = { SetupMemEditHandler, SetupMemEditModalHandler };
