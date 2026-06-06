// interaction-handlers/setup/setupMemberAdd.js
// Thêm đơn + Bulk import (nhiều ID/mention cùng lúc)
'use strict';
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { InteractionHandler, InteractionHandlerTypes } = require('@sapphire/framework');
const memberService = require('../../services/memberService.js');
const { MemberView } = require('../../src/commands/setup/_views/_MemberView.js');
const log = require('../../utils/logger.js');
const { requireAdmin } = require('../../utils/permissions.js');

const ADD_MODAL_ID  = 'setup:mem:add:modal';
const BULK_MODAL_ID = 'setup:mem:bulk:modal';

// ── Thêm đơn ─────────────────────────────────────────────────────────────────
function openAddMemberModal(interaction) {
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(ADD_MODAL_ID)
      .setTitle('Thêm thành viên')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('User ID hoặc @mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('VD: 123456789012345678 hoặc @user')
            .setMaxLength(100)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phong_ban')
            .setLabel('Phòng ban (tuỳ chọn)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ghi_chu')
            .setLabel('Ghi chú (tuỳ chọn)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(false),
        ),
      ),
  );
}

async function handleAddMemberModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'thêm thành viên', deferred: true });
  if (!ok) return;

  const { guild } = interaction;
  const rawId   = interaction.fields.getTextInputValue('user_id').trim();
  const phongBan = interaction.fields.getTextInputValue('phong_ban').trim().slice(0, 50) || null;
  const ghiChu   = interaction.fields.getTextInputValue('ghi_chu').trim().slice(0, 100) || null;

  let userId = rawId.startsWith('<@') && rawId.endsWith('>')
    ? rawId.slice(2, -1).replace('!', '')
    : rawId;

  let member;
  try { member = await guild.members.fetch(userId); } catch {
    return interaction.editReply({ content: `❌ Không tìm thấy thành viên với ID: \`${userId}\`` });
  }
  if (member.user.bot)
    return interaction.editReply({ content: '❌ Không thể thêm bot.' });

  try {
    await memberService.upsertMember({
      guildId: guild.id, userId,
      phongBan, ghiChu,
      username: member.nickname ?? member.displayName ?? member.user.username,
    });
  } catch (e) {
    log.error('SETUP_MEM_ADD', guild.id, 'Thêm thành viên thất bại: %s', e.message);
    return interaction.editReply({ content: '❌ Không thể thêm thành viên, thử lại sau.' });
  }
  log.info('SETUP_MEM_ADD', guild.id, 'Đã thêm %s (%s)', userId, member.user.username);

  try {
    const members = await memberService.getMembers(guild.id);
    await interaction.message?.edit(MemberView.render({ members, page: 0, guild })).catch(() => null);
  } catch (_e) { /* fallthrough */ }

  return interaction.editReply({
    content: `✅ Đã thêm **${member.displayName ?? member.user.username}** vào danh sách.`,
  });
}

// ── Bulk import ───────────────────────────────────────────────────────────────
function openBulkImportModal(interaction) {
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(BULK_MODAL_ID)
      .setTitle('Import nhiều thành viên')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('user_ids')
            .setLabel('Danh sách User ID (mỗi ID 1 dòng)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              '123456789012345678\n987654321098765432\n<@111222333444555666>\n...'
            )
            .setMaxLength(2000)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('phong_ban')
            .setLabel('Phòng ban chung (tuỳ chọn, áp cho tất cả)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(false),
        ),
      ),
  );
}

async function handleBulkImportModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { ok } = await requireAdmin(interaction, { context: 'import thành viên', deferred: true });
  if (!ok) return;

  const { guild } = interaction;
  const rawLines = interaction.fields.getTextInputValue('user_ids')
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const phongBan = interaction.fields.getTextInputValue('phong_ban').trim().slice(0, 50) || null;

  if (rawLines.length === 0)
    return interaction.editReply({ content: '❌ Không có ID nào hợp lệ.' });
  if (rawLines.length > 50)
    return interaction.editReply({ content: `❌ Tối đa 50 thành viên mỗi lần (bạn nhập ${rawLines.length}).` });

  // Parse IDs
  const userIds = rawLines.map(r =>
    r.startsWith('<@') && r.endsWith('>') ? r.slice(2, -1).replace('!', '') : r
  );

  const results = { added: [], skipped: [], failed: [] };

  for (const userId of userIds) {
    if (!/^\d{17,20}$/.test(userId)) { results.failed.push(userId); continue; }
    let member;
    try { member = await guild.members.fetch(userId); } catch {
      results.failed.push(userId); continue;
    }
    if (member.user.bot) { results.skipped.push(userId); continue; }
    try {
      await memberService.upsertMember({
        guildId: guild.id, userId,
        phongBan,
        username: member.nickname ?? member.displayName ?? member.user.username,
      });
      results.added.push(userId);
    } catch {
      results.failed.push(userId);
    }
  }

  log.info('SETUP_MEM_BULK', guild.id, 'Bulk import: +%d skip:%d fail:%d',
    results.added.length, results.skipped.length, results.failed.length);

  const lines = [
    `✅ Đã thêm: **${results.added.length}** thành viên`,
    results.skipped.length ? `⏭️ Bỏ qua (bot): ${results.skipped.length}` : null,
    results.failed.length
      ? `❌ Thất bại (${results.failed.length}): ${results.failed.slice(0, 5).join(', ')}${results.failed.length > 5 ? '...' : ''}` : null,
  ].filter(Boolean).join('\n');

  try {
    const members = await memberService.getMembers(guild.id);
    await interaction.message?.edit(MemberView.render({ members, page: 0, guild })).catch(() => null);
  } catch (_e) { /* fallthrough */ }

  return interaction.editReply({ content: lines });
}

// ── Handlers ──────────────────────────────────────────────────────────────────
class SetupMemberAddHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    return interaction.customId === 'setup:mem:add' ? this.some() : this.none();
  }
  run(interaction) { return openAddMemberModal(interaction); }
}

class SetupMemberBulkHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.Button });
  }
  parse(interaction) {
    return interaction.customId === 'setup:mem:bulk' ? this.some() : this.none();
  }
  run(interaction) { return openBulkImportModal(interaction); }
}

class SetupMemberAddModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    return interaction.customId === ADD_MODAL_ID ? this.some() : this.none();
  }
  run(interaction) { return handleAddMemberModal(interaction); }
}

class SetupMemberBulkModalHandler extends InteractionHandler {
  constructor(ctx, options) {
    super(ctx, { ...options, interactionHandlerType: InteractionHandlerTypes.ModalSubmit });
  }
  parse(interaction) {
    return interaction.customId === BULK_MODAL_ID ? this.some() : this.none();
  }
  run(interaction) { return handleBulkImportModal(interaction); }
}

module.exports = {
  SetupMemberAddHandler,
  SetupMemberBulkHandler,
  SetupMemberAddModalHandler,
  SetupMemberBulkModalHandler,
};
