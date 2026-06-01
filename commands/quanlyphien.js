// commands/quanlyphien.js — Quản lý Phiên (UX/UI nâng cao)
// Fix: STATUS_EMOJI + tất cả status string → tham_gia/khong_tham_gia/tre/co_phep
'use strict';
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const db = require('../db.js');

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const STATUS_EMOJI = { tham_gia: '✅', khong_tham_gia: '❌', tre: '⏰', co_phep: '🟡' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTs(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function durationStr(startedAt, endedAt) {
  const ms = new Date(endedAt ?? Date.now()) - new Date(startedAt);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function buildActiveEmbed(session, attendances) {
  const present  = attendances.filter(a => a.status === 'tham_gia').length;
  const late     = attendances.filter(a => a.status === 'tre').length;
  const eligible = (session.eligible_member_ids ?? []).length;

  return new EmbedBuilder()
    .setColor(0x01696f)
    .setTitle(`🟢 Phiên đang chạy — ${session.session_name}`)
    .addFields(
      { name: '🆔 ID',          value: `\`${session.id}\``,                                        inline: true },
      { name: '⏱️ Bắt đầu',    value: fmtTs(session.started_at ?? session.created_at),             inline: true },
      { name: '⏳ Đang chạy',   value: durationStr(session.started_at ?? session.created_at, null), inline: true },
      { name: '✅ Có mặt',      value: `${present}`,                                                inline: true },
      { name: '⏰ Trễ',         value: `${late}`,                                                   inline: true },
      { name: '👥 Bắt buộc',    value: eligible > 0 ? `${eligible}` : 'Tất cả',                    inline: true },
      { name: '📋 Tổng ĐD',     value: `${attendances.length}`,                                    inline: true },
      { name: '📢 Kênh',        value: session.channel_id ? `<#${session.channel_id}>` : '—',      inline: true },
      { name: '👤 Tạo bởi',     value: `<@${session.started_by}>`,                                 inline: true },
    )
    .setFooter({ text: 'Chọn hành động bên dưới' })
    .setTimestamp();
}

function buildHistoryListEmbed(sessions) {
  if (!sessions.length) {
    return new EmbedBuilder()
      .setColor(0x7a7974)
      .setTitle('📚 Lịch sử Phiên')
      .setDescription('Chưa có phiên nào kết thúc.');
  }
  const lines = sessions.map((s, i) =>
    `**${i + 1}.** \`${s.id.slice(0, 8)}\` **${s.session_name}** — ${fmtTs(s.ended_at)}`
  );
  return new EmbedBuilder()
    .setColor(0x006494)
    .setTitle('📚 Lịch sử Phiên (20 phiên gần nhất)')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Chọn phiên từ menu để xem chi tiết' })
    .setTimestamp();
}

function buildSessionDetailEmbed(session, attendances) {
  const counts = { tham_gia: 0, khong_tham_gia: 0, tre: 0, co_phep: 0 };
  for (const a of attendances) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const eligible = (session.eligible_member_ids ?? []).length;

  const topRows = attendances
    .filter(a => a.status === 'tham_gia' || a.status === 'tre')
    .slice(0, 15)
    .map(a => `${STATUS_EMOJI[a.status] ?? '❓'} <@${a.user_id}>`);

  return new EmbedBuilder()
    .setColor(session.cancelled ? 0xa12c7b : 0x437a22)
    .setTitle(`${session.cancelled ? '🚫' : '✅'} ${session.session_name}`)
    .addFields(
      { name: '🆔 ID',        value: `\`${session.id}\``,                                                             inline: true },
      { name: '📅 Bắt đầu',  value: fmtTs(session.started_at ?? session.created_at),                                  inline: true },
      { name: '🏁 Kết thúc', value: fmtTs(session.ended_at),                                                          inline: true },
      { name: '⏱️ Thời gian', value: durationStr(session.started_at ?? session.created_at, session.ended_at),         inline: true },
      { name: '✅ Có mặt',   value: `${counts.tham_gia}`,                                                              inline: true },
      { name: '⏰ Trễ',      value: `${counts.tre}`,                                                                   inline: true },
      { name: '❌ Vắng',     value: `${counts.khong_tham_gia}`,                                                        inline: true },
      { name: '🟡 Có phép',  value: `${counts.co_phep}`,                                                               inline: true },
      { name: '👥 Bắt buộc', value: eligible > 0 ? `${eligible}` : 'Tất cả',                                          inline: true },
    )
    .addFields({
      name: `👤 Danh sách có mặt / trễ (${topRows.length})`,
      value: topRows.length ? topRows.join('\n') : '_Không có_',
    })
    .setFooter({ text: session.cancelled ? 'Phiên đã bị hủy' : 'Phiên đã kết thúc' })
    .setTimestamp();
}

// ─── Row builders ─────────────────────────────────────────────────────────────
function activeSessionRow(sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`qp_view_${sessionId}`)
      .setLabel('👁️ Xem điểm danh')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`qp_end_${sessionId}`)
      .setLabel('🏁 Kết thúc')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`qp_cancel_${sessionId}`)
      .setLabel('🚫 Hủy phiên')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`qp_refresh_${sessionId}`)
      .setLabel('🔄 Làm mới')
      .setStyle(ButtonStyle.Secondary),
  );
}

function historySelectRow(sessions) {
  const opts = sessions.slice(0, 25).map(s => ({
    label: s.session_name.slice(0, 100),
    description: fmtTs(s.ended_at).slice(0, 100),
    value: s.id,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('qp_history_select')
      .setPlaceholder('Chọn phiên để xem chi tiết…')
      .addOptions(opts),
  );
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('qp_back_history')
      .setLabel('◀ Quay lại danh sách')
      .setStyle(ButtonStyle.Secondary),
  );
}

function confirmRow(action, sessionId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`qp_confirm_${action}_${sessionId}`)
      .setLabel('✅ Xác nhận')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('qp_cancel_confirm')
      .setLabel('❌ Hủy bỏ')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─── Command ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('quanlyphien')
    .setDescription('📋 Quản lý phiên điểm danh — xem, kết thúc, hủy, lịch sử')
    .addStringOption(opt =>
      opt.setName('che_do')
        .setDescription('Chế độ xem (mặc định: phiên đang chạy)')
        .setRequired(false)
        .addChoices(
          { name: '🟢 Phiên đang chạy', value: 'active' },
          { name: '📚 Lịch sử phiên',   value: 'history' },
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageGuild')) {
      return interaction.reply({
        content: '⛔ Bạn cần quyền **Quản lý Server** để dùng lệnh này.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const mode    = interaction.options.getString('che_do') ?? 'active';
    const { guildId } = interaction;

    // ── Chế độ ACTIVE ──────────────────────────────────────────────────────────
    if (mode === 'active') {
      const session = await db.getActiveSession(guildId);
      if (!session) {
        return interaction.editReply({ content: '🔴 Không có phiên nào đang chạy.' });
      }

      const attendances = await db.getAttendances(session.id);
      const msg = await interaction.editReply({
        embeds: [buildActiveEmbed(session, attendances)],
        components: [activeSessionRow(session.id)],
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5 * 60_000,
        filter: i => i.user.id === interaction.user.id,
      });

      collector.on('collect', async (btn) => {
        await btn.deferUpdate();

        if (btn.customId.startsWith('qp_refresh_')) {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) {
            await btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
            return;
          }
          const a2 = await db.getAttendances(s2.id);
          await btn.editReply({ embeds: [buildActiveEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
          return;
        }

        if (btn.customId.startsWith('qp_view_')) {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) {
            await btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
            return;
          }
          const a2 = await db.getAttendances(s2.id);
          await btn.editReply({ embeds: [buildSessionDetailEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
          return;
        }

        if (btn.customId.startsWith('qp_end_') || btn.customId.startsWith('qp_cancel_')) {
          const action = btn.customId.startsWith('qp_end_') ? 'end' : 'cancel';
          const sid    = btn.customId.replace(`qp_${action}_`, '');
          const label  = action === 'end' ? 'kết thúc' : 'hủy';
          const confirmEmbed = new EmbedBuilder()
            .setColor(0xa13544)
            .setTitle(`⚠️ Xác nhận ${label} phiên?`)
            .setDescription(
              `Bạn có chắc muốn **${label}** phiên \`${sid.slice(0, 8)}\` không?\nHành động này **không thể hoàn tác**.`
            );
          await btn.editReply({ embeds: [confirmEmbed], components: [confirmRow(action, sid)] });
          return;
        }

        if (btn.customId.startsWith('qp_confirm_')) {
          const parts      = btn.customId.split('_');
          const realAction = parts[2];
          const realSid    = parts.slice(3).join('_');
          if (realAction === 'end')    await db.endSession(realSid);
          if (realAction === 'cancel') await db.cancelSession(realSid);
          const doneEmbed = new EmbedBuilder()
            .setColor(realAction === 'end' ? 0x437a22 : 0xa12c7b)
            .setTitle(realAction === 'end' ? '✅ Phiên đã kết thúc' : '🚫 Phiên đã bị hủy')
            .setDescription(`Phiên \`${realSid.slice(0, 8)}\` đã được **${realAction === 'end' ? 'kết thúc' : 'hủy'}** thành công.`)
            .setTimestamp();
          await btn.editReply({ embeds: [doneEmbed], components: [] });
          collector.stop();
          return;
        }

        if (btn.customId === 'qp_cancel_confirm') {
          const s2 = await db.getActiveSession(guildId);
          if (!s2) {
            await btn.editReply({ content: '🔴 Phiên đã kết thúc.', embeds: [], components: [] });
            return;
          }
          const a2 = await db.getAttendances(s2.id);
          await btn.editReply({ embeds: [buildActiveEmbed(s2, a2)], components: [activeSessionRow(s2.id)] });
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {});
      });
      return;
    }

    // ── Chế độ HISTORY ─────────────────────────────────────────────────────────
    if (mode === 'history') {
      const sessions  = await db.getSessionHistory(guildId, { limit: 20, offset: 0 });
      const components = sessions.length ? [historySelectRow(sessions)] : [];
      const msg = await interaction.editReply({
        embeds: [buildHistoryListEmbed(sessions)],
        components,
      });

      if (!sessions.length) return;

      const collector = msg.createMessageComponentCollector({
        time: 5 * 60_000,
        filter: i => i.user.id === interaction.user.id,
      });

      collector.on('collect', async (comp) => {
        await comp.deferUpdate();

        if (comp.customId === 'qp_history_select') {
          const sid = comp.values[0];
          const s   = await db.getSessionByIdRaw(sid, guildId);
          if (!s) {
            await comp.editReply({ content: '⚠️ Không tìm thấy phiên.', embeds: [], components: [] });
            return;
          }
          const attendances = await db.getAttendances(sid);
          await comp.editReply({
            embeds: [buildSessionDetailEmbed(s, attendances)],
            components: [backRow()],
          });
          return;
        }

        if (comp.customId === 'qp_back_history') {
          const ss2 = await db.getSessionHistory(guildId, { limit: 20, offset: 0 });
          await comp.editReply({
            embeds: [buildHistoryListEmbed(ss2)],
            components: ss2.length ? [historySelectRow(ss2)] : [],
          });
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {});
      });
    }
  },
};
