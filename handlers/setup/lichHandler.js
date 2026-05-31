// handlers/setup/lichHandler.js — quản lý lịch cố định (menu, add, edit, delete, early open/close)
'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../../utils/embeds.js');
const { TEN_THU, TEN_THU_FULL, pad, ngayThucTe, formatDongStr, parseThuGio } = require('./helpers.js');
const { buildDashboard } = require('./dashboardHandler.js');

// ─── Helper: tạo placeholder gợi ý ngày thực tế ─────────────────────────────
function makePlaceholder(thuStr, gioStr) {
  // thuStr = 'T7', gioStr = '21:00'
  try {
    const thuMap = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
    const thu = thuMap[thuStr.toUpperCase()];
    if (thu === undefined) return `${thuStr} ${gioStr}`;
    const [h, m] = gioStr.split(':').map(Number);
    const { label } = ngayThucTe(thu, h, m);
    // label = "Thứ Bảy, 06/06/2026 21:00" → chỉ lấy dd/MM/yyyy
    const dateMatch = label.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) return `${thuStr} ${gioStr}`;
    return `${thuStr} ${gioStr}  →  ${dateMatch[1]}`;
  } catch (_) {
    return `${thuStr} ${gioStr}`;
  }
}

// Tính placeholder từ day_of_week + hour + minute (số)
function makePlaceholderFromNums(dayOfWeek, hour, minute) {
  try {
    const { label } = ngayThucTe(dayOfWeek, hour, minute);
    const dateMatch = label.match(/(\d{2}\/\d{2}\/\d{4})/);
    const thuStr = TEN_THU[dayOfWeek];
    const timeStr = `${pad(hour)}:${pad(minute)}`;
    if (!dateMatch) return `${thuStr} ${timeStr}`;
    return `${thuStr} ${timeStr}  →  ${dateMatch[1]}`;
  } catch (_) {
    return `${TEN_THU[dayOfWeek]} ${pad(hour)}:${pad(minute)}`;
  }
}

// ─── lichMenuComponents ───────────────────────────────────────────────────────
function lichMenuComponents(lichList) {
  const embed = new EmbedBuilder()
    .setTitle('📅 Quản lý Lịch Cố Định')
    .setDescription(
      lichList.length
        ? lichList.map((l, i) => {
            const mo   = `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
            const dong = formatDongStr(l);
            return `**${i+1}.** \`${l.id.slice(0,8)}\` **${l.session_name}**\n> Mở: ${mo} | Đóng: ${dong} | <#${l.channel_id}>`;
          }).join('\n\n')
        : '⚠️ Chưa có lịch nào. Nhấn **Thêm mới** để tạo.',
    )
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const rows = [];
  if (lichList.length) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:lich:select')
        .setPlaceholder('Chọn lịch để quản lý...')
        .addOptions(lichList.slice(0,25).map(l => ({
          label: l.session_name.slice(0,100),
          description: `${TEN_THU[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)} | ${l.id.slice(0,8)}`,
          value: l.id,
        }))),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:lich:add').setLabel('➕ Thêm mới').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:dashboard').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
  ));
  return { embeds: [embed], components: rows, ephemeral: true };
}

// ─── lichActionComponents ─────────────────────────────────────────────────────
function lichActionComponents(lich, lichList, activeSession = null) {
  const mo   = `${TEN_THU_FULL[lich.day_of_week]} ${pad(lich.hour)}:${pad(lich.minute)}`;
  const dong = formatDongStr(lich);
  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Quản lý: ${lich.session_name}`)
    .setDescription([
      `**Mở:** ${mo}`,
      `**Đóng:** ${dong}`,
      `**Kênh:** <#${lich.channel_id}>`,
      `**ID:** \`${lich.id}\``,
    ].join('\n'))
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT });

  const hasActiveSession = !!activeSession;
  const canEarlyClose    = hasActiveSession && lich.close_day_of_week != null;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup:lich:early_open:${lich.id}`)
      .setLabel('▶️ Mở ngay').setStyle(ButtonStyle.Success)
      .setDisabled(hasActiveSession),
    new ButtonBuilder().setCustomId(`setup:lich:early_close:${lich.id}`)
      .setLabel('⏹️ Đóng ngay').setStyle(ButtonStyle.Danger)
      .setDisabled(!canEarlyClose),
    new ButtonBuilder().setCustomId(`setup:lich:edit:${lich.id}`)
      .setLabel('✏️ Sửa').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`setup:lich:confirm_delete:${lich.id}`)
      .setLabel('🗑️ Xóa').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('← Danh sách').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

// ─── handleShowAddModal — 4 field (tạo mới cần đủ thông tin) ─────────────────
async function handleShowAddModal(interaction) {
  // Tính ngày thực tế gần nhất cho placeholder gợi ý
  const phMo   = makePlaceholderFromNums(6, 21, 0);   // T7 21:00
  const phDong = makePlaceholderFromNums(6, 23, 30);  // T7 23:30

  const modal = new ModalBuilder()
    .setCustomId('setup:lich:modal')
    .setTitle('➕ Thêm Lịch Cố Định');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ten').setLabel('Tên phiên').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('gio_mo').setLabel('Thứ & Giờ MỞ — format: T7 21:00').setStyle(TextInputStyle.Short)
        .setPlaceholder(phMo).setRequired(true).setMaxLength(10),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('gio_dong').setLabel('Thứ & Giờ ĐÓNG — để trống = không tự đóng').setStyle(TextInputStyle.Short)
        .setPlaceholder(phDong).setRequired(false).setMaxLength(10),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('kenh_id').setLabel('Channel ID (để trống = kênh hiện tại)').setStyle(TextInputStyle.Short)
        .setPlaceholder('Dán Channel ID vào đây').setRequired(false).setMaxLength(20),
    ),
  );
  await interaction.showModal(modal);
  return true;
}

async function handleLich(interaction) {
  const { customId, guild } = interaction;

  if (customId === 'setup:lich:menu') {
    await interaction.deferUpdate();
    const lichList = await db.getLichCoDinh(guild.id);
    await interaction.editReply(lichMenuComponents(lichList));
    return true;
  }

  if (customId === 'setup:lich:select') {
    await interaction.deferUpdate();
    const lichId = interaction.values[0];
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.editReply({ content: '❌ Không tìm thấy lịch.', ephemeral: true });
      return true;
    }
    const activeSession = await db.getActiveSession(guild.id);
    await interaction.editReply(lichActionComponents(lich, lichList, activeSession));
    return true;
  }

  // Early open
  if (customId.startsWith('setup:lich:early_open:')) {
    const lichId = customId.replace('setup:lich:early_open:', '');
    await interaction.deferReply({ ephemeral: true });
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.editReply({ content: '❌ Không tìm thấy lịch.' }); return true; }
    const activeSession = await db.getActiveSession(guild.id);
    if (activeSession) { await interaction.editReply({ content: '⚠️ Đang có phiên mở, không thể mở thêm.' }); return true; }
    const { morPhienTheoLich } = require('../../utils/scheduler.js');
    await morPhienTheoLich(interaction.client, guild, lich);
    await interaction.editReply({ content: `✅ Đã mở phiên **${lich.session_name}** ngay lập tức.` });
    return true;
  }

  // Early close
  if (customId.startsWith('setup:lich:early_close:')) {
    const lichId = customId.replace('setup:lich:early_close:', '');
    await interaction.deferReply({ ephemeral: true });
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.editReply({ content: '❌ Không tìm thấy lịch.' }); return true; }
    if (lich.close_day_of_week == null) { await interaction.editReply({ content: '⚠️ Lịch này không có giờ đóng tự động.' }); return true; }
    const { dongPhienTheoLich } = require('../../utils/scheduler.js');
    await dongPhienTheoLich(interaction.client, guild, lich);
    await interaction.editReply({ content: `✅ Đã đóng phiên **${lich.session_name}** ngay lập tức.` });
    return true;
  }

  // ─── Edit modal SHOW — 2 field: Giờ MỞ & Giờ ĐÓNG, placeholder có ngày thực tế ──
  if (customId.startsWith('setup:lich:edit:') && !customId.includes(':modal:')) {
    const lichId = customId.replace('setup:lich:edit:', '');
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.reply({ content: '❌ Không tìm thấy lịch.', ephemeral: true }); return true; }

    const moStr   = `${TEN_THU[lich.day_of_week]} ${pad(lich.hour)}:${pad(lich.minute)}`;
    const dongStr = lich.close_day_of_week != null
      ? `${TEN_THU[lich.close_day_of_week]} ${pad(lich.close_hour)}:${pad(lich.close_minute)}`
      : '';

    // Placeholder hiện ngày thực tế gần nhất
    const phMo   = makePlaceholderFromNums(lich.day_of_week, lich.hour, lich.minute);
    const phDong = lich.close_day_of_week != null
      ? makePlaceholderFromNums(lich.close_day_of_week, lich.close_hour, lich.close_minute)
      : 'T7 23:30  →  ' + (() => {
          try {
            const { label } = ngayThucTe(6, 23, 30);
            const d = label.match(/(\d{2}\/\d{2}\/\d{4})/);
            return d ? d[1] : '06/06/2026';
          } catch (_) { return ''; }
        })();

    const modal = new ModalBuilder()
      .setCustomId(`setup:lich:edit:modal:${lichId}`)
      .setTitle(`✏️ Sửa Lịch — ${lich.session_name.slice(0, 35)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_mo')
          .setLabel('Thứ & Giờ MỞ — format: T7 21:00')
          .setStyle(TextInputStyle.Short)
          .setValue(moStr)
          .setPlaceholder(phMo)
          .setRequired(true)
          .setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_dong')
          .setLabel('Thứ & Giờ ĐÓNG — để trống = không tự đóng')
          .setStyle(TextInputStyle.Short)
          .setValue(dongStr)
          .setPlaceholder(phDong)
          .setRequired(false)
          .setMaxLength(10),
      ),
    );
    await interaction.showModal(modal);
    return true;
  }

  // ─── Edit modal SUBMIT ────────────────────────────────────────────────────────
  if (customId.startsWith('setup:lich:edit:modal:')) {
    const lichId = customId.replace('setup:lich:edit:modal:', '');
    await interaction.deferReply({ ephemeral: true });
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.editReply({ content: '❌ Không tìm thấy lịch.' }); return true; }

    const moRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const dongRaw = interaction.fields.getTextInputValue('gio_dong').trim();

    const parsed = parseThuGio(moRaw);
    if (!parsed) return interaction.editReply({ content: '❌ Định dạng giờ mở không hợp lệ. Dùng: `T7 21:00` hoặc `CN 08:30`' });

    let parsedDong = null;
    if (dongRaw) {
      parsedDong = parseThuGio(dongRaw);
      if (!parsedDong) return interaction.editReply({ content: '❌ Định dạng giờ đóng không hợp lệ.' });
    }

    const ten       = lich.session_name;
    const channelId = lich.channel_id;

    const updated = await db.suaLichCoDinh(guild.id, lichId, {
      dayOfWeek: parsed.thu, hour: parsed.gio, minute: parsed.phut,
      sessionName: ten,
      closeDayOfWeek: parsedDong?.thu ?? null, closeHour: parsedDong?.gio ?? null, closeMinute: parsedDong?.phut ?? null,
      channelId,
    });
    try {
      const { cancelLichCoDinh, scheduleLichCoDinh } = require('../../utils/scheduler.js');
      cancelLichCoDinh(guild.id, lichId);
      await scheduleLichCoDinh(interaction.client, guild, updated);
    } catch (e) { console.warn('[lichHandler] reschedule sau edit:', e.message); }

    const { label: moLabel } = ngayThucTe(parsed.thu, parsed.gio, parsed.phut);
    const dongDisplay = parsedDong
      ? (() => { const { label, note } = ngayThucTe(parsedDong.thu, parsedDong.gio, parsedDong.phut, parsed.thu, parsed.gio, parsed.phut); return note ? `${label} ${note}` : label; })()
      : 'Không tự đóng';
    await interaction.editReply({ content: [`✅ Đã cập nhật lịch **${ten}**`, `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`, `Kênh: <#${channelId}> | ID: \`${lichId}\``].join('\n') });
    return true;
  }

  // Confirm delete
  if (customId.startsWith('setup:lich:confirm_delete:')) {
    const lichId = customId.replace('setup:lich:confirm_delete:', '');
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    const ten  = lich?.session_name ?? lichId.slice(0,8);
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Xác nhận xóa lịch')
      .setDescription(`Bạn có chắc muốn xóa lịch **${ten}**?\n> Hành động này không thể hoàn tác.`)
      .setColor(0xED4245).setFooter({ text: FOOTER_DEFAULT });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:lich:delete:${lichId}`).setLabel('✅ Xác nhận Xóa').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`setup:lich:back:${lichId}`).setLabel('← Hủy, quay lại').setStyle(ButtonStyle.Secondary),
    );
    await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  // Back from delete confirm
  if (customId.startsWith('setup:lich:back:')) {
    const lichId = customId.replace('setup:lich:back:', '');
    const lichList = await db.getLichCoDinh(guild.id);
    const lich = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.update(lichMenuComponents(lichList)); return true; }
    const activeSession = await db.getActiveSession(guild.id);
    await interaction.update(lichActionComponents(lich, lichList, activeSession));
    return true;
  }

  // Delete
  if (customId.startsWith('setup:lich:delete:')) {
    const lichId = customId.replace('setup:lich:delete:', '');
    await db.xoaLichCoDinh(guild.id, lichId);
    try { const { cancelLichCoDinh } = require('../../utils/scheduler.js'); cancelLichCoDinh(guild.id, lichId); } catch (_) {}
    const lichList = await db.getLichCoDinh(guild.id);
    const payload = lichMenuComponents(lichList);
    payload.content = `🗑️ Đã xóa lịch \`${lichId.slice(0,8)}...\``;
    await interaction.update(payload);
    return true;
  }

  // Add modal
  if (customId === 'setup:lich:add') return handleShowAddModal(interaction);

  // Add modal submit
  if (customId === 'setup:lich:modal') {
    await interaction.deferReply({ ephemeral: true });
    const ten     = interaction.fields.getTextInputValue('ten').trim();
    const moRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const dongRaw = interaction.fields.getTextInputValue('gio_dong').trim();
    const kenhRaw = interaction.fields.getTextInputValue('kenh_id').trim();
    const parsed = parseThuGio(moRaw);
    if (!parsed) return interaction.editReply({ content: '❌ Định dạng giờ mở không hợp lệ. Dùng: `T7 21:00` hoặc `CN 08:30`' });
    let parsedDong = null;
    if (dongRaw) {
      parsedDong = parseThuGio(dongRaw);
      if (!parsedDong) return interaction.editReply({ content: '❌ Định dạng giờ đóng không hợp lệ.' });
    }
    const channelId = kenhRaw || interaction.channel?.id;
    if (!channelId) return interaction.editReply({ content: '❌ Không xác định được kênh.' });
    if (kenhRaw) {
      const ch = guild.channels.cache.get(kenhRaw) || await guild.channels.fetch(kenhRaw).catch(() => null);
      if (!ch) return interaction.editReply({ content: `❌ Không tìm thấy kênh ID \`${kenhRaw}\`.` });
    }
    const cfgCurrent  = await db.getConfig(guild.id);
    const phaiRoleIds = cfgCurrent.phai_role_ids ?? [];
    const lich = await db.themLichCoDinh(guild.id, {
      dayOfWeek: parsed.thu, hour: parsed.gio, minute: parsed.phut,
      sessionName: ten,
      closeDayOfWeek: parsedDong?.thu ?? null, closeHour: parsedDong?.gio ?? null, closeMinute: parsedDong?.phut ?? null,
      phaiRoleIds, channelId,
    });
    try {
      const { scheduleLichCoDinh } = require('../../utils/scheduler.js');
      await scheduleLichCoDinh(interaction.client, guild, lich);
    } catch (e) { console.warn('[lichHandler] scheduleLichCoDinh sau add:', e.message); }
    const { label: moLabel } = ngayThucTe(parsed.thu, parsed.gio, parsed.phut);
    const dongDisplay = parsedDong
      ? (() => { const { label, note } = ngayThucTe(parsedDong.thu, parsedDong.gio, parsedDong.phut, parsed.thu, parsed.gio, parsed.phut); return note ? `${label} ${note}` : label; })()
      : 'Không tự đóng';
    await interaction.editReply({ content: [`✅ Đã thêm lịch **${ten}**`, `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`, `Kênh: <#${channelId}> | ID: \`${lich.id}\``].join('\n') });
    return true;
  }

  return false;
}

module.exports = { handleLich, lichMenuComponents, lichActionComponents };
