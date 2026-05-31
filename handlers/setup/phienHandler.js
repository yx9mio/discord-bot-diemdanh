// handlers/setup/phienHandler.js — Quản lý Phiên thủ công từ Dashboard
// Menu: xem phiên đang mở, đóng phiên thủ công, xem lịch sử phiên gần đây
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder,
} = require('discord.js');
const db  = require('../../db.js');
const log = require('../../utils/logger.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT, buildSummaryEmbed } = require('../../utils/embeds.js');
const { ketThucPhien, thongBaoHuyHieu }                     = require('../../utils/session.js');
const { buildAttendanceButtons }                            = require('../../utils/embeds.js');

// ── Helpers ──────────────────────────────────────────────────────────────────
function tsRel(iso) {
  if (!iso) return '_N/A_';
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
}
function tsDate(iso) {
  if (!iso) return '_N/A_';
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:f>`;
}

// ── Build menu chính Quản lý Phiên ───────────────────────────────────────────
async function buildPhienMenu(guild) {
  const active  = await db.getActiveSession(guild.id);
  const history = await db.getSessionHistory(guild.id, 5);

  // Phiên đang mở
  let activeField;
  if (active) {
    const attended = await db.getAttendances(active.id);
    const present  = attended.filter(a => a.status === 'tham_gia').length;
    const late     = attended.filter(a => a.status === 'tre').length;
    const absent   = attended.filter(a => a.status === 'khong_tham_gia').length;
    activeField = [
      `🟢 **${active.session_name}**`,
      `▸ Mở: ${tsRel(active.created_at)}`,
      `▸ Kênh: <#${active.channel_id}>`,
      `▸ Điểm danh: ✅ ${present} | ⏰ ${late} | ❌ ${absent}`,
      `▸ ID: \`${active.id}\``,
    ].join('\n');
  } else {
    activeField = '⚫ Không có phiên đang mở';
  }

  // Lịch sử 5 phiên gần nhất
  let historyField;
  if (history.length) {
    historyField = history.map((s, i) => {
      const ended = s.ended_at ? tsDate(s.ended_at) : '_Chưa đóng_';
      return `\`${i + 1}\` **${s.session_name}** — ${ended}`;
    }).join('\n');
  } else {
    historyField = '_Chưa có phiên nào_';
  }

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('📋  Quản lý Phiên Điểm Danh')
    .addFields(
      { name: '🟢 Phiên đang mở', value: activeField, inline: false },
      { name: '🕐 Lịch sử gần đây (5 phiên)', value: historyField, inline: false },
    )
    .setColor(active ? 0x57F287 : 0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:phien:dong')
      .setLabel('⏹️ Đóng phiên ngay')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!active),
    new ButtonBuilder()
      .setCustomId('setup:phien:lamsach')
      .setLabel('🧹 Dọn phiên kẹt')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!!active), // chỉ cần khi KHÔNG có active nhưng DB còn orphan
    new ButtonBuilder()
      .setCustomId('setup:phien:history')
      .setLabel('📜 Lịch sử đầy đủ')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:phien:refresh')
      .setLabel('🔄 Làm mới')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:dashboard')
      .setLabel('← Quay lại')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

// ── Đóng phiên thủ công (với confirm) ────────────────────────────────────────
async function buildDongConfirm(guild) {
  const active = await db.getActiveSession(guild.id);
  if (!active) {
    return {
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription('⚫ Không có phiên nào đang mở.')],
      components: [],
      ephemeral: true,
    };
  }

  const attended = await db.getAttendances(active.id);
  const present  = attended.filter(a => a.status === 'tham_gia').length;
  const late     = attended.filter(a => a.status === 'tre').length;
  const absent   = attended.filter(a => a.status === 'khong_tham_gia').length;

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('⚠️ Xác nhận đóng phiên')
    .setDescription([
      `Bạn sắp **đóng thủ công** phiên:`,
      `> 🎯 **${active.session_name}**`,
      `> 📅 Mở lúc ${tsDate(active.created_at)}`,
      `> ✅ ${present} tham gia | ⏰ ${late} trễ | ❌ ${absent} vắng`,
      '',
      '⚡ Hành động này sẽ:',
      '• Đóng phiên & cập nhật DB ngay lập tức',
      '• Vô hiệu hóa nút điểm danh trên embed',
      '• Gửi tổng kết + CSV vào kênh',
    ].join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:phien:dong_confirm')
      .setLabel('✅ Xác nhận đóng')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('setup:phien:menu')
      .setLabel('✗ Hủy')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

// ── Thực thi đóng phiên ───────────────────────────────────────────────────────
async function execDongPhien(interaction, guild) {
  const active = await db.getActiveSession(guild.id);
  if (!active) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚫ Không có phiên đang mở.')],
      components: [],
    });
    return;
  }

  // 1. Đóng trong DB
  await db.closeSession(active.id);

  const attended = await db.getAttendances(active.id);
  const statsMap = await ketThucPhien(guild, active, attended);

  // 2. Vô hiệu hóa nút trên embed gốc
  try {
    const ch = await guild.channels.fetch(active.channel_id).catch(() => null);
    if (ch && active.message_id) {
      const msg = await ch.messages.fetch(active.message_id).catch(() => null);
      if (msg) {
        const { buildSessionEmbed } = require('../../utils/embeds.js');
        const closedEmbed = await buildSessionEmbed(guild, active, attended, true);
        await msg.edit({
          embeds: [closedEmbed],
          components: [buildAttendanceButtons(true)],
        }).catch(() => null);
      }

      // 3. Gửi tổng kết
      const closedEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔒 Phiên đã kết thúc (thủ công bởi Admin)')
        .setDescription(
          `✅ Tham gia: ${attended.filter(a => a.status === 'tham_gia').length} | ` +
          `❌ Vắng: ${attended.filter(a => a.status === 'khong_tham_gia').length} | ` +
          `📋 Có phép: ${attended.filter(a => a.status === 'co_phep').length}`
        );
      const summaryEmbed = await buildSummaryEmbed(active, attended, guild);
      await ch.send({ embeds: [closedEmbed, summaryEmbed] });

      // 4. CSV
      try {
        const { guiCsvDinhKem } = require('../../utils/session.js');
        await guiCsvDinhKem(ch, active, attended);
      } catch (_) {}

      // 5. Huy hiệu
      try {
        await thongBaoHuyHieu(interaction.client, guild.id, active, attended);
      } catch (_) {}
    }
  } catch (e) {
    log.warn('PHIEN_HANDLER', guild.id, 'Lỗi khi gửi tổng kết: %s', e.message);
  }

  // 6. Cập nhật lại menu về trạng thái đã đóng
  const refreshed = await buildPhienMenu(guild);
  await interaction.editReply({
    ...refreshed,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`✅ Đã đóng phiên **${active.session_name}** thành công. Tổng kết đã gửi vào kênh.`),
      ...refreshed.embeds,
    ],
  });
}

// ── Dọn phiên kẹt (session có ended_at = null nhưng không active đúng nghĩa) ──
async function execLamSach(interaction, guild) {
  // Lấy tất cả session ended_at IS NULL
  const orphans = await db.getOrphanSessions(guild.id).catch(() => []);
  if (!orphans || orphans.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription('✅ Không có phiên kẹt nào cần dọn.')],
      components: [],
    });
    return;
  }
  let closed = 0;
  for (const s of orphans) {
    try { await db.closeSession(s.id); closed++; } catch (_) {}
  }
  const refreshed = await buildPhienMenu(guild);
  await interaction.editReply({
    ...refreshed,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`🧹 Đã dọn **${closed}** phiên kẹt.`),
      ...refreshed.embeds,
    ],
  });
}

// ── Xem lịch sử đầy đủ ───────────────────────────────────────────────────────
async function buildHistoryFull(guild) {
  const history = await db.getSessionHistory(guild.id, 20);
  let desc;
  if (history.length) {
    desc = history.map((s, i) => {
      const ended = s.ended_at ? tsDate(s.ended_at) : '⚠️ _Chưa đóng_';
      return `\`${String(i + 1).padStart(2, '0')}\` **${s.session_name}** — ${ended}`;
    }).join('\n');
  } else {
    desc = '_Chưa có phiên nào_';
  }

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('📜  Lịch sử Phiên (20 gần nhất)')
    .setDescription(desc)
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:phien:menu')
      .setLabel('← Quay lại')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

// ── Router chính ──────────────────────────────────────────────────────────────
async function handlePhien(interaction) {
  const { customId, guild } = interaction;
  if (!customId.startsWith('setup:phien:')) return false;

  await interaction.deferUpdate();

  switch (customId) {
    case 'setup:phien:menu':
    case 'setup:phien:refresh': {
      const payload = await buildPhienMenu(guild);
      await interaction.editReply(payload);
      return true;
    }
    case 'setup:phien:dong': {
      const payload = await buildDongConfirm(guild);
      await interaction.editReply(payload);
      return true;
    }
    case 'setup:phien:dong_confirm': {
      await execDongPhien(interaction, guild);
      return true;
    }
    case 'setup:phien:lamsach': {
      await execLamSach(interaction, guild);
      return true;
    }
    case 'setup:phien:history': {
      const payload = await buildHistoryFull(guild);
      await interaction.editReply(payload);
      return true;
    }
    default:
      return false;
  }
}

module.exports = { handlePhien };
