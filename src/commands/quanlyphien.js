// src/commands/quanlyphien.js
'use strict';
const { Command } = require('@sapphire/framework');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../db.js');

const DAY_NAMES    = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

function fmtTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}
function durationStr(startedAt, endedAt) {
  const ms = new Date(endedAt ?? Date.now()) - new Date(startedAt);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function buildActiveEmbed(session, attendances) {
  const present  = attendances.filter(a => a.status === 'tham_gia').length;
  const late     = attendances.filter(a => a.status === 'tre').length;
  const eligible = (session.eligible_member_ids ?? []).length;
  return new EmbedBuilder().setColor(0x01696f).setTitle(`🟢 Phiên đang chạy — ${session.session_name}`)
    .addFields(
      { name: '🆔 ID',       value: `\`${session.id}\``,                                         inline: true },
      { name: '⏱️ Bắt đầu', value: fmtTs(session.started_at ?? session.created_at),              inline: true },
      { name: '⏳ Đang chạy', value: durationStr(session.started_at ?? session.created_at, null), inline: true },
      { name: '✅ Có mặt',   value: `${present}`,                                                  inline: true },
      { name: '⏰ Trễ',     value: `${late}`,                                                      inline: true },
      { name: '👥 Bắt buộc', value: eligible > 0 ? `${eligible}` : 'Tất cả',                       inline: true },
      { name: '📋 Tổng ĐĐ', value: `${attendances.length}`,                                        inline: true },
      { name: '📢 Kênh',    value: session.channel_id ? `<#${session.channel_id}>` : '—',         inline: true },
    ).setFooter({ text: 'Chọn hành động bên dưới' }).setTimestamp();
}
function buildSessionDetailEmbed(session, attendances) {
  const counts = { tham_gia: 0, khong_tham_gia: 0, tre: 0, co_phep: 0 };
  for (const a of attendances) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const eligible = (session.eligible_member_ids ?? []).length;
  const topRows  = attendances.filter(a => a.status === 'tham_gia' || a.status === 'tre').slice(0, 15).map(a => `${STATUS_EMOJI[a.status] ?? '❓'} <@${a.user_id}>`);
  return new EmbedBuilder().setColor(session.cancelled ? 0xa12c7b : 0x437a22)
    .setTitle(`${session.cancelled ? '🚫' : '✅'} ${session.session_name}`)
    .addFields(
      { name: '🆔 ID',        value: `\`${session.id}\``, inline: true },
      { name: '📅 Bắt đầu',  value: fmtTs(session.started_at ?? session.created_at), inline: true },
      { name: '🏁 Kết thúc', value: fmtTs(session.ended_at), inline: true },
      { name: '⏱️ Thời gian', value: durationStr(session.started_at ?? session.created_at, session.ended_at), inline: true },
      { name: '✅ Có mặt',   value: `${counts.tham_gia}`,     inline: true },
      { name: '⏰ Trễ',      value: `${counts.tre}`,           inline: true },
      { name: '❌ Vắng',     value: `${counts.khong_tham_gia}`, inline: true },
      { name: '🟡 Có phép',  value: `${counts.co_phep}`,       inline: true },
      { name: '👥 Bắt buộc', value: eligible > 0 ? `${eligible}` : 'Tất cả', inline: true },
    )
    .addFields({ name: `👤 Có mặt / trễ (${topRows.length})`, value: topRows.length ? topRows.join('\n') : '_Không có_' })
    .setFooter({ text: session.cancelled ? 'Phiên đã bị hủy' : 'Phiên đã kết thúc' }).setTimestamp();
}
function buildHistoryListEmbed(sessions) {
  if (!sessions.length) return new EmbedBuilder().setColor(0x7a7974).setTitle('📚 Lịch sử Phiên').setDescription('Chưa có phiên nào kết thúc.');
  const lines = sessions.map((s, i) => `**${i + 1}.** \`${s.id.slice(0, 8)}\` **${s.session_name}** — ${fmtTs(s.ended_at)}`);
  return new EmbedBuilder().setColor(0x006494).setTitle('📚 Lịch sử Phiên (20 phiên gần nhất)').setDescription(lines.join('\n')).setFooter({ text: 'Chọn phiên từ menu để xem chi tiết' }).setTimestamp();
}
function activeSessionRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`qp_view_${sessionId}`).setLabel('👁️ Xem điểm danh').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`qp_end_${sessionId}`).setLabel('🏁 Kết thúc').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`qp_cancel_${sessionId}`).setLabel('🚫 Hủy phiên').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`qp_refresh_${sessionId}`).setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary),
  );
}
function historySelectRow(sessions) {
  const opts = sessions.slice(0, 25).map(s => ({ label: s.session_name.slice(0, 100), description: fmtTs(s.ended_at).slice(0, 100), value: s.id }));
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qp_history_select').setPlaceholder('Chọn phiên để xem chi tiết…').addOptions(opts));
}
function backRow() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qp_back_history').setLabel('◀ Quay lại danh sách').setStyle(ButtonStyle.Secondary));
}
function confirmRow(action, sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`qp_confirm_${action}_${sessionId}`).setLabel('✅ Xác nhận').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('qp_cancel_confirm').setLabel('❌ Hủy bỏ').setStyle(ButtonStyle.Secondary),
  );
}

class QuanLyPhienCommand extends Command {
  constructor(context) {
    super(context, { name: 'quanlyphien', description: '📋 Quản lý phiên điểm danh', preconditions: ['AdminOnly'] });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(builder =>
      builder
        .setName('quanlyphien')
        .setDescription('📋 Quản lý phiên điểm danh — xem, kết thúc, hủy, lịch sử')
        .addStringOption(opt =>
          opt.setName('che_do').setDescription('Chế độ xem').setRequired(false)
            .addChoices(
              { name: '🟢 Phiên đang chạy', value: 'active' },
              { name: '📚 Lịch sử phiên',   value: 'history' },
            )
        )
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const mode = interaction.options.getString('che_do') ?? 'active';
    const { guildId } = interaction;

    if (mode === 'active') {
      const session = await db.getActiveSession(guildId);
      if (!session) return interaction.editReply({ content: '🔴 Không có phiên nào đang chạy.' });

      const attendances = await db.getAttendances(session.id);
      const msg = await interaction.editReply({ embeds: [buildActiveEmbed(session, attendances)], components: [activeSessionRow(session.id)] });

      const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60_000, filter: i => i.user.id === interaction.user.id });

      collector.on('collect', async (btn) => {
        await btn.deferUpdate();
        if (btn.customId.startsWith('qp_refresh_')) {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) return btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
          const a2 = await db.getAttendances(s2.id);
          return btn.editReply({ embeds: [buildActiveEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
        }
        if (btn.customId.startsWith('qp_view_')) {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) return btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
          const a2 = await db.getAttendances(s2.id);
          return btn.editReply({ embeds: [buildSessionDetailEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
        }
        if (btn.customId.startsWith('qp_end_')) {
          const sid = btn.customId.replace('qp_end_', '');
          return btn.editReply({ content: '⚠️ Xác nhận kết thúc phiên?', embeds: [], components: [confirmRow('end', sid)] });
        }
        if (btn.customId.startsWith('qp_cancel_') && !btn.customId.startsWith('qp_cancel_confirm')) {
          const sid = btn.customId.replace('qp_cancel_', '');
          return btn.editReply({ content: '⚠️ Xác nhận hủy phiên? Dữ liệu sẽ bị xóa!', embeds: [], components: [confirmRow('cancel', sid)] });
        }
        if (btn.customId.startsWith('qp_confirm_end_')) {
          const sid = btn.customId.replace('qp_confirm_end_', '');
          await db.endSession(sid);
          collector.stop();
          return btn.editReply({ content: '✅ Phiên đã kết thúc.', embeds: [], components: [] });
        }
        if (btn.customId.startsWith('qp_confirm_cancel_')) {
          const sid = btn.customId.replace('qp_confirm_cancel_', '');
          await db.cancelSession(sid);
          collector.stop();
          return btn.editReply({ content: '🚫 Phiên đã bị hủy.', embeds: [], components: [] });
        }
        if (btn.customId === 'qp_cancel_confirm') {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) return btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
          const a2 = await db.getAttendances(s2.id);
          return btn.editReply({ embeds: [buildActiveEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
        }
      });
      collector.on('end', (_, reason) => { if (reason === 'time') interaction.editReply({ components: [] }).catch(() => null); });
      return;
    }

    // mode === 'history'
    const sessions = await db.getSessionHistory(guildId, { limit: 20, offset: 0 });
    if (!sessions.length) return interaction.editReply({ content: 'Chưa có phiên nào kết thúc.' });

    const msg = await interaction.editReply({ embeds: [buildHistoryListEmbed(sessions)], components: [historySelectRow(sessions)] });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 5 * 60_000, filter: i => i.user.id === interaction.user.id });

    collector.on('collect', async (sel) => {
      await sel.deferUpdate();
      const sessionId = sel.values[0];
      const session   = sessions.find(s => s.id === sessionId);
      if (!session) return sel.editReply({ content: '⚠️ Không tìm thấy phiên.' });
      const attendances = await db.getAttendances(session.id);
      await sel.editReply({ embeds: [buildSessionDetailEmbed(session, attendances)], components: [backRow()] });
    });
    collector.on('end', (_, reason) => { if (reason === 'time') interaction.editReply({ components: [] }).catch(() => null); });
  }
}

module.exports = { QuanLyPhienCommand };
