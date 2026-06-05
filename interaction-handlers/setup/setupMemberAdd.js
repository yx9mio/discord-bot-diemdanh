'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../services/memberService.js');
const { MemberView } = require('../../src/commands/setup/_MemberView.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const ADD_MODAL_ID = 'setup:mem:add:modal';

function openAddMemberModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(ADD_MODAL_ID)
    .setTitle('Thêm thành viên');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('User ID hoặc @mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('VD: 123456789012345678 hoặc @user')
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('phong_ban')
        .setLabel('Phòng ban (tuỳ chọn)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ghi_chu')
        .setLabel('Ghi chú (tuỳ chọn)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false),
    ),
  );
  return interaction.showModal(modal);
}

async function handleAddMemberModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
  if (!ok) return;

  const { guild } = interaction;
  const rawId = interaction.fields.getTextInputValue('user_id').trim();
  const phongBan = interaction.fields.getTextInputValue('phong_ban').trim() || null;
  const ghiChu = interaction.fields.getTextInputValue('ghi_chu').trim() || null;

  // [UX] Parse @mention → userId
  let userId = rawId;
  if (rawId.startsWith('<@') && rawId.endsWith('>')) {
    userId = rawId.slice(2, -1).replace('!', '');
  }

  let member;
  try {
    member = await guild.members.fetch(userId);
  } catch {
    return interaction.editReply({ content: `❌ Không tìm thấy thành viên với ID: ${userId}` });
  }

  if (member.user.bot) {
    return interaction.editReply({ content: '❌ Không thể thêm bot.' });
  }

  try {
    await memberService.upsertMember({
      guildId: guild.id,
      userId,
      phongBan,
      ghiChu,
      username: member.nickname ?? member.displayName ?? member.user.username,
    });
  } catch (e) {
    log.error('SETUP_MEM_ADD', guild.id, 'Thêm thành viên thất bại: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể thêm thành viên, thử lại sau.' });
  }

  log.info('SETUP_MEM_ADD', guild.id, 'Đã thêm thành viên %s (%s)', userId, member.user.tag);

  // [UX] Auto-refresh MemberView trên message gốc
  try {
    const members = await memberService.getMembers(guild.id);
    const view = MemberView.render({ members, page: 0, guild });
    await interaction.message?.edit(view).catch(() => null);
  } catch (_e) { /* fallthrough — không block reply nếu refresh lỗi */ }

  return interaction.editReply({
    content: `✅ Đã thêm **${member.displayName ?? member.user.username}** vào danh sách quản lý.`,
  });
}

class SetupMemberAddHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }

  parse(interaction) {
    if (interaction.customId === 'setup:mem:add') return this.some();
    return this.none();
  }

  run(interaction) {
    return openAddMemberModal(interaction);
  }
}

class SetupMemberAddModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }

  parse(interaction) {
    if (interaction.customId === ADD_MODAL_ID) return this.some();
    return this.none();
  }

  run(interaction) {
    return handleAddMemberModal(interaction);
  }
}

module.exports = {
  SetupMemberAddHandler,
  SetupMemberAddModalHandler,
};
