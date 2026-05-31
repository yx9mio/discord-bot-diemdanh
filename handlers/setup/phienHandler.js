// handlers/setup/phienHandler.js — Quản lý Phiên từ Dashboard (Admin)
// Tính năng: xem phiên đang mở, đóng, đổi tên, lịch sử phân trang,
//            xem chi tiết attendance, xóa phiên đã đóng, dọn kẹt.
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
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
function tsDShort(iso) {
  if (!iso) return '_N/A_';
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:d>`;
}

const STATUS_LABEL = {
  tham_gia:          '✅ Tham gia',
  tre:               '⏰ Trễ',
  khong_tham_gia:    '❌ Vắng',
  co_phep:           '📋 Có phép',
  chua_diem_danh:    '❓ Chưa DD',
};
function statusLabel(s) { return STATUS_LABEL[s] ?? `\`${s}\``; }

// ── Menu chính Quản lý Phiên ─────────────────────────────────────────────────
async function buildPhienMenu(guild) {
  const active  = await db.getActiveSession(guild.id);
  const history = await db.getSessionHistory(guild.id, 5);

  // --- Phiên đang mở ---
  let activeField;
  if (active) {
    const attended = await db.getAttendances(active.id);
    const present  = attended.filter(a => a.status === 'tham_gia').length;
    const late     = attended.filter(a => a.status === 'tre').length;
    const absent   = attended.filter(a => a.status === 'khong_tham_gia').length;
    const coPhep   = attended.filter(a => a.status === 'co_phep').length;
    activeField = [
      `🟢 **${active.session_name}**`,
      `▸ Mở: ${tsRel(active.created_at)}`,
      `▸ Kênh: <#${active.channel_id}>`,
      `▸ Điểm danh: ✅ ${present} | ⏰ ${late} | ❌ ${absent} | 📋 ${coPhep}`,
      `▸ ID: \`${active.id}\``,
    ].join('\n');
  } else {
    activeField = '⚫ Không có phiên đang mở';
  }

  // --- Lịch sử 5 phiên gần nhất ---
  let historyField;
  if (history.length) {
    historyField = history.map((s, i) => {
      const ended = s.ended_at ? tsDShort(s.ended_at) : '_Chưa đóng_';
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

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:phien:dong')
      .setLabel('⏹️ Đóng phiên')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!active),
    new ButtonBuilder()
      .setCustomId('setup:phien:doiten')
      .setLabel('✏️ Đổi tên')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!active),
    new ButtonBuilder()
      .setCustomId('setup:phien:chitiet')
      .setLabel('🔍 Chi tiết')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!active),
    new ButtonBuilder()
      .setCustomId('setup:phien:lamsach')
      .setLabel('🧹 Dọn kẹt')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!!active),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:phien:history:0')
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

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

// ── Chi tiết phiên đang mở ────────────────────────────────────────────────────
async function buildChiTietActive(guild) {
  const active = await db.getActiveSession(guild.id);
  if (!active) {
    return {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚫ Không có phiên đang mở.')],
      components: [_backRow('setup:phien:menu')],
      ephemeral: true,
    };
  }

  const attended = await db.getAttendances(active.id);
  const byStatus = {};
  for (const a of attended) {
    if (!byStatus[a.status]) byStatus[a.status] = [];
    byStatus[a.status].push(a);
  }

  const fields = [];
  for (const [status, rows] of Object.entries(byStatus)) {
    const names = rows.map(r => `<@${r.user_id}>`).join(' ');
    fields.push({ name: statusLabel(status), value: names || '—', inline: false });
  }
  if (!fields.length) fields.push({ name: 'Chưa có ai điểm danh', value: '—', inline: false });

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`🔍  Chi tiết phiên: ${active.session_name}`)
    .setDescription([
      `▸ Mở: ${tsDate(active.created_at)}`,
      `▸ Kênh: <#${active.channel_id}>`,
      `▸ Tổng điểm danh: **${attended.length}** bản ghi`,
    ].join('\n'))
    .addFields(...fields)
    .setColor(0x57F287)
    .setFooter({ text: `${FOOTER_DEFAULT} • ID: ${active.id}` })
    .setTimestamp();

  return {
    embeds: [embed],
    components: [_backRow('setup:phien:menu')],
    ephemeral: true,
  };
}

// ── Lịch sử phân trang ────────────────────────────────────────────────────────
const HISTORY_PER_PAGE = 10;

async function buildHistoryPage(guild, page = 0) {
  const offset   = page * HISTORY_PER_PAGE;
  const history  = await db.getSessionHistory(guild.id, { limit: HISTORY_PER_PAGE + 1, offset });
  const hasNext  = history.length > HISTORY_PER_PAGE;
  const items    = history.slice(0, HISTORY_PER_PAGE);

  let desc;
  if (items.length) {
    desc = items.map((s, i) => {
      const ended   = s.ended_at ? tsDShort(s.ended_at) : '⚠️ _Chưa đóng_';
      const eligible = (s.eligible_member_ids ?? []).length;
      return [
        `\`${String(offset + i + 1).padStart(2, '0')}\``,
        `**${s.session_name}**`,
        `— ${ended}`,
        eligible ? `| ${eligible} thành viên đủ điều kiện` : '',
        `| \`${s.id.slice(0, 8)}…\``,
      ].filter(Boolean).join(' ');
    }).join('\n');
  } else {
    desc = '_Chưa có phiên nào._';
  }

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`📜  Lịch sử Phiên — Trang ${page + 1}`)
    .setDescription(desc)
    .setColor(0x5865F2)
    .setFooter({ text: `${FOOTER_DEFAULT} • Trang ${page + 1}` })
    .setTimestamp();

  // Select menu chọn phiên để xem chi tiết / xóa
  const components = [];

  if (items.length) {
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:phien:select_phien')
        .setPlaceholder('Chọn phiên để xem chi tiết hoặc xóa…')
        .addOptions(
          items.map(s => ({
            label: s.session_name.slice(0, 100),
            description: s.ended_at
              ? `Đóng: ${new Date(s.ended_at).toLocaleDateString('vi-VN')}`
              : 'Chưa đóng',
            value: s.id,
          }))
        )
    );
    components.push(selectRow);
  }

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:phien:history:${page - 1}`)
      .setLabel('◀ Trang trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`setup:phien:history:${page + 1}`)
      .setLabel('Trang sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasNext),
    new ButtonBuilder()
      .setCustomId('setup:phien:menu')
      .setLabel('← Quay lại')
      .setStyle(ButtonStyle.Secondary),
  );
  components.push(navRow);

  return { embeds: [embed], components, ephemeral: true };
}

// ── Chi tiết phiên lịch sử (theo ID) ─────────────────────────────────────────
async function buildChiTietById(guild, sessionId) {
  const session = await db.getSessionByIdRaw(sessionId, guild.id);
  if (!session) {
    return {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Không tìm thấy phiên này.')],
      components: [_backRow('setup:phien:history:0')],
      ephemeral: true,
    };
  }

  const attended = await db.getAttendances(session.id);
  const byStatus = {};
  for (const a of attended) {
    if (!byStatus[a.status]) byStatus[a.status] = [];
    byStatus[a.status].push(a);
  }

  const fields = [];
  for (const [status, rows] of Object.entries(byStatus)) {
    const names = rows.map(r => `<@${r.user_id}>`).join(' ');
    fields.push({ name: statusLabel(status), value: names.slice(0, 1024) || '—', inline: false });
  }
  if (!fields.length) fields.push({ name: 'Không có dữ liệu điểm danh', value: '—', inline: false });

  const eligible = (session.eligible_member_ids ?? []).length;

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle(`🔍  Chi tiết phiên: ${session.session_name}`)
    .setDescription([
      `▸ Mở: ${tsDate(session.created_at)}`,
      `▸ Đóng: ${tsDate(session.ended_at)}`,
      `▸ Kênh: ${session.channel_id ? `<#${session.channel_id}>` : '_N/A_'}`,
      eligible ? `▸ Thành viên đủ điều kiện: **${eligible}**` : '',
      `▸ Tổng bản ghi: **${attended.length}**`,
    ].filter(Boolean).join('\n'))
    .addFields(...fields)
    .setColor(session.cancelled ? 0xED4245 : 0x5865F2)
    .setFooter({ text: `${FOOTER_DEFAULT} • ID: ${session.id}` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:phien:xoa_confirm:${session.id}`)
      .setLabel('🗑️ Xóa phiên này')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!!session.is_active), // không cho xóa phiên đang mở
    new ButtonBuilder()
      .setCustomId('setup:phien:history:0')
      .setLabel('← Lịch sử')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup:phien:menu')
      .setLabel('⌂ Menu')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [actionRow], ephemeral: true };
}

// ── Đổi tên phiên đang mở (Modal) ────────────────────────────────────────────
async function showDoiTenModal(interaction, guild) {
  const active = await db.getActiveSession(guild.id);
  if (!active) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚫ Không có phiên đang mở.')],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`setup:phien:doiten_submit:${active.id}`)
    .setTitle('✏️ Đổi tên Phiên');

  const input = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('Tên mới của phiên')
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(80)
    .setRequired(true)
    .setValue(active.session_name);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function execDoiTen(interaction, guild, sessionId) {
  const newName = interaction.fields.getTextInputValue('new_name')?.trim();
  if (!newName) {
    await interaction.reply({ content: '❌ Tên không được để trống.', ephemeral: true });
    return;
  }

  const session = await db.getSessionByIdRaw(sessionId, guild.id);
  if (!session || !session.is_active) {
    await interaction.reply({ content: '❌ Phiên không còn hợp lệ.', ephemeral: true });
    return;
  }

  const { error } = await db.supabase
    .from('sessions')
    .update({ session_name: newName })
    .eq('id', sessionId)
    .eq('guild_id', guild.id);

  if (error) {
    log.error('PHIEN_HANDLER', guild.id, 'Lỗi đổi tên: %s', error.message);
    await interaction.reply({ content: '❌ Lỗi khi đổi tên phiên.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();
  const payload = await buildPhienMenu(guild);
  await interaction.editReply({
    ...payload,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`✅ Đã đổi tên phiên thành **${newName}**.`),
      ...payload.embeds,
    ],
  });
}

// ── Xác nhận xóa phiên ────────────────────────────────────────────────────────
async function buildXoaConfirm(guild, sessionId) {
  const session = await db.getSessionByIdRaw(sessionId, guild.id);
  if (!session) {
    return {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Không tìm thấy phiên.')],
      components: [_backRow('setup:phien:history:0')],
      ephemeral: true,
    };
  }

  const attended = await db.getAttendances(session.id);

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('⚠️ Xác nhận xóa phiên')
    .setDescription([
      `Bạn sắp **xóa vĩnh viễn** phiên:`,
      `> 🎯 **${session.session_name}**`,
      `> 📅 Mở: ${tsDate(session.created_at)}`,
      `> 📅 Đóng: ${tsDate(session.ended_at)}`,
      `> 📊 **${attended.length}** bản ghi điểm danh sẽ bị xóa theo`,
      '',
      '⚡ **Hành động này không thể hoàn tác!**',
    ].join('\n'))
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:phien:xoa_exec:${session.id}`)
      .setLabel('🗑️ Xóa vĩnh viễn')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('setup:phien:history:0')
      .setLabel('✗ Hủy')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

async function execXoaPhien(interaction, guild, sessionId) {
  const session = await db.getSessionByIdRaw(sessionId, guild.id);
  if (!session || session.is_active) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Không thể xóa phiên đang mở.')],
      components: [_backRow('setup:phien:history:0')],
    });
    return;
  }

  // Xóa attendance trước, rồi xóa session
  await db.supabase.from('attendances').delete().eq('session_id', sessionId);
  await db.supabase.from('sessions').delete().eq('id', sessionId).eq('guild_id', guild.id);

  const payload = await buildHistoryPage(guild, 0);
  await interaction.editReply({
    ...payload,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`🗑️ Đã xóa phiên **${session.session_name}** thành công.`),
      ...payload.embeds,
    ],
  });
}

// ── Đóng phiên với confirm ────────────────────────────────────────────────────
async function buildDongConfirm(guild) {
  const active = await db.getActiveSession(guild.id);
  if (!active) {
    return {
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚫ Không có phiên nào đang mở.')],
      components: [_backRow('setup:phien:menu')],
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

  await db.closeSession(active.id);
  const attended = await db.getAttendances(active.id);
  await ketThucPhien(guild, active, attended);

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

      try { const { guiCsvDinhKem } = require('../../utils/session.js'); await guiCsvDinhKem(ch, active, attended); } catch (_) {}
      try { await thongBaoHuyHieu(interaction.client, guild.id, active, attended); } catch (_) {}
    }
  } catch (e) {
    log.warn('PHIEN_HANDLER', guild.id, 'Lỗi khi gửi tổng kết: %s', e.message);
  }

  const refreshed = await buildPhienMenu(guild);
  await interaction.editReply({
    ...refreshed,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`✅ Đã đóng phiên **${active.session_name}** thành công.`),
      ...refreshed.embeds,
    ],
  });
}

// ── Dọn phiên kẹt ────────────────────────────────────────────────────────────
async function execLamSach(interaction, guild) {
  // Tìm session ended_at IS NULL nhưng is_active = false (orphan)
  const { data: orphans } = await db.supabase
    .from('sessions')
    .select('id')
    .eq('guild_id', guild.id)
    .is('ended_at', null)
    .eq('is_active', false)
    .eq('cancelled', false)
    .limit(50);

  if (!orphans || orphans.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('✅ Không có phiên kẹt nào.')],
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
      new EmbedBuilder().setColor(0x57F287).setDescription(`🧹 Đã dọn **${closed}** phiên kẹt.`),
      ...refreshed.embeds,
    ],
  });
}

// ── Back row helper ───────────────────────────────────────────────────────────
function _backRow(customId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
  );
}

// ── Router chính ──────────────────────────────────────────────────────────────
async function handlePhien(interaction) {
  const { customId, guild } = interaction;
  if (!customId.startsWith('setup:phien:')) return false;

  // Modal submit — KHÔNG deferUpdate trước
  if (customId.startsWith('setup:phien:doiten_submit:')) {
    const sessionId = customId.split(':')[3];
    await execDoiTen(interaction, guild, sessionId);
    return true;
  }

  // Modal open — KHÔNG deferUpdate
  if (customId === 'setup:phien:doiten') {
    await showDoiTenModal(interaction, guild);
    return true;
  }

  // Select menu chọn phiên
  if (customId === 'setup:phien:select_phien') {
    await interaction.deferUpdate();
    const sessionId = interaction.values[0];
    const payload = await buildChiTietById(guild, sessionId);
    await interaction.editReply(payload);
    return true;
  }

  // Tất cả buttons còn lại — deferUpdate
  await interaction.deferUpdate();

  // Phân trang lịch sử: setup:phien:history:{page}
  if (customId.startsWith('setup:phien:history:')) {
    const page = parseInt(customId.split(':')[3] ?? '0', 10) || 0;
    const payload = await buildHistoryPage(guild, Math.max(0, page));
    await interaction.editReply(payload);
    return true;
  }

  // Xóa confirm: setup:phien:xoa_confirm:{id}
  if (customId.startsWith('setup:phien:xoa_confirm:')) {
    const sessionId = customId.replace('setup:phien:xoa_confirm:', '');
    const payload = await buildXoaConfirm(guild, sessionId);
    await interaction.editReply(payload);
    return true;
  }

  // Xóa exec: setup:phien:xoa_exec:{id}
  if (customId.startsWith('setup:phien:xoa_exec:')) {
    const sessionId = customId.replace('setup:phien:xoa_exec:', '');
    await execXoaPhien(interaction, guild, sessionId);
    return true;
  }

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
    case 'setup:phien:chitiet': {
      const payload = await buildChiTietActive(guild);
      await interaction.editReply(payload);
      return true;
    }
    default:
      return false;
  }
}

module.exports = { handlePhien };
