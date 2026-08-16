'use strict';
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, FOOTER_DEFAULT } = require('../embeds.js');

const SELECT_CH = 'setup:wizard:ch';
const SELECT_ROLE = 'setup:wizard:role';
const BTN_NEXT = 'setup:wizard:next';
const BTN_BACK = 'setup:wizard:back';
const BTN_CANCEL = 'setup:wizard:cancel';
const BTN_CONFIRM = 'setup:wizard:confirm';

const CHANNEL_OPTION_LIMIT = 25;
const ROLE_OPTION_LIMIT = 25;

function _channels(guild) {
  const arr = guild.channels.cache
    .filter(c => c.type === 0)
    .sort((a, b) => a.position - b.position)
    .first(CHANNEL_OPTION_LIMIT);
  return arr || [];
}

function _roles(guild) {
  const arr = guild.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .first(ROLE_OPTION_LIMIT);
  return arr || [];
}

function _channelName(channelId, guild) {
  const ch = channelId ? guild.channels.cache.get(channelId) : null;
  return ch ? `#${ch.name}` : '—';
}

function _roleName(roleId, guild) {
  if (!roleId) return 'Không giới hạn';
  const role = guild.roles.cache.get(roleId);
  return role ? `@${role.name}` : '—';
}

function renderStep2({ guild, draft }) {
  const channels = _channels(guild);
  const roles = _roles(guild);

  const channelSelect = new StringSelectMenuBuilder()
    .setCustomId(SELECT_CH)
    .setPlaceholder('Chọn kênh đăng bảng điểm danh')
    .addOptions(
      channels.length
        ? channels.map(c => new StringSelectMenuOptionBuilder()
            .setLabel(`#${c.name}`)
            .setValue(c.id)
            .setDescription(`Kênh: ${c.id}`)
            .setDefault(draft.channelId === c.id))
        : [new StringSelectMenuOptionBuilder().setLabel('Không có kênh text').setValue('none').setDefault(true)],
    );

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ROLE)
    .setPlaceholder('Role được phép điểm danh (tuỳ chọn)')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('Không giới hạn role')
        .setValue('none')
        .setDefault(!draft.roleId),
      ...roles.map(r => new StringSelectMenuOptionBuilder()
        .setLabel(`@${r.name}`)
        .setValue(r.id)
        .setDescription(`Role: ${r.id}`)
        .setDefault(draft.roleId === r.id)),
    ]);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Tạo Bang Chiến — Bước 2/3')
    .setColor(COLORS.INFO)
    .setDescription(
      `**${draft.ten}**${draft.moTa ? `\n_${draft.moTa}_` : ''}\n\n` +
      `⏱️ Tự đóng sau: **${draft.phut ? `${draft.phut} phút` : 'thủ công'}**\n\n` +
      'Chọn **kênh** để đăng bảng điểm danh và **role** được phép tham gia:',
    )
    .setFooter({ text: `${FOOTER_DEFAULT} · Hết hạn sau 10 phút` });

  const components = [
    new ActionRowBuilder().addComponents(channelSelect),
    new ActionRowBuilder().addComponents(roleSelect),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(BTN_NEXT).setLabel('Tiếp theo ▶').setStyle(ButtonStyle.Primary).setDisabled(!draft.channelId),
      new ButtonBuilder().setCustomId(BTN_CANCEL).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embeds: [embed], components };
}

function renderStep3({ guild, draft }) {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ Tạo Bang Chiến — Bước 3/3')
    .setColor(COLORS.WARN)
    .addFields(
      { name: '🏷️ Tên', value: draft.ten, inline: true },
      { name: '⏱️ Tự đóng', value: draft.phut ? `${draft.phut} phút` : 'Thủ công', inline: true },
      { name: '📢 Kênh', value: _channelName(draft.channelId, guild), inline: true },
      { name: '🎟️ Role tham gia', value: _roleName(draft.roleId, guild), inline: true },
    );
  if (draft.moTa) embed.addFields({ name: '📝 Mô tả', value: draft.moTa, inline: false });

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(BTN_CONFIRM).setLabel('✅ Xác nhận mở Bang Chiến').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(BTN_BACK).setLabel('◀ Quay lại').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(BTN_CANCEL).setLabel('Hủy').setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embeds: [embed], components };
}

module.exports = {
  SELECT_CH, SELECT_ROLE, BTN_NEXT, BTN_BACK, BTN_CANCEL, BTN_CONFIRM,
  renderStep2, renderStep3, _channels, _roles,
};