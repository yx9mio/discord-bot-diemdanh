// handlers/setupUiHandler.js — Xử lý toàn bộ interaction của /setup
// FIX:
// BUG #1 #8: ngayThucTe() nhận refDay/refHour/refMinute
// BUG #2:    Preset BC description đúng
// BUG #3 #4: Modal kenh_id placeholder & validate
// BUG #5:    Placeholder giờ đóng không ghi "tuần sau"
// BUG #6:    lichActionComponents nhận activeSession
//            canEarlyClose = hasActiveSession && close_day_of_week != null
//            early_close handler guard close_day_of_week == null
// BUG #7:    formatDongStr() đúng
'use strict';
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} = require('discord.js');
const db = require('../db.js');
const { buildDashboard: _buildDashboard, FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { laAdmin } = require('../utils/helpers.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEN_THU      = ['CN','T2','T3','T4','T5','T6','T7'];
const TEN_THU_FULL = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const pad = n => String(n).padStart(2, '0');

// ─── FEAT 1.3: Danh sách preset ─────────────────────────────────────────────
const PRESETS = [
  {
    value: 'bang_chien',
    label: '⚔️ Bang Chiến',
    description: 'T7 21:00 → T7 23:30 (2h30p)',
    data: { day_of_week:6, hour:21, minute:0, close_day_of_week:6, close_hour:23, close_minute:30 },
  },
  {
    value: 'hoi_dong',
    label: '🏛️ Hội Đồng Môn Phái',
    description: 'CN 20:00 → CN 22:00 (2h)',
    data: { day_of_week:0, hour:20, minute:0, close_day_of_week:0, close_hour:22, close_minute:0 },
  },
  {
    value: 'luyen_tap',
    label: '🥋 Luyện Tập Thường',
    description: 'T3 20:00 → T3 21:30 (1h30p)',
    data: { day_of_week:2, hour:20, minute:0, close_day_of_week:2, close_hour:21, close_minute:30 },
  },
  {
    value: 'tuy_chinh',
    label: '✏️ Tùy chỉnh',
    description: 'Nhập tay qua form',
    data: null,
  },
];

// ─── ngayThucTe() — BUG #1 #7 #8 FIX ───────────────────────────────────────
function ngayThucTe(dayOfWeek, hour, minute, refDay = null, refHour = null, refMinute = null) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowVn  = new Date(Date.now() + VN_OFFSET);
  const curDay = nowVn.getUTCDay();
  const curH   = nowVn.getUTCHours();
  const curM   = nowVn.getUTCMinutes();

  let isSameDayBeforeOpen = false;
  if (refDay !== null && dayOfWeek === refDay) {
    const closeMin = hour * 60 + minute;
    const openMin  = refHour * 60 + refMinute;
    if (closeMin < openMin) isSameDayBeforeOpen = true;
  }

  let daysUntil = (dayOfWeek - curDay + 7) % 7;

  if (!isSameDayBeforeOpen) {
    if (daysUntil === 0) {
      const secPassed = curH * 3600 + curM * 60;
      const secTarget = hour * 3600 + minute * 60;
      if (secPassed >= secTarget) daysUntil = 7;
    }
  }

  const target = new Date(nowVn.getTime() + daysUntil * 86400000);
  const dd     = pad(target.getUTCDate());
  const mm     = pad(target.getUTCMonth() + 1);
  const yyyy   = target.getUTCFullYear();
  const label  = `${TEN_THU_FULL[dayOfWeek]}, ${dd}/${mm}/${yyyy} ${pad(hour)}:${pad(minute)}`;
  const note   = isSameDayBeforeOpen ? '*(trước giờ mở — cùng ngày)*' : null;

  return { label, note };
}

function formatDongStr(lich) {
  if (lich.close_day_of_week == null) return 'Không tự đóng';
  const { label, note } = ngayThucTe(
    lich.close_day_of_week, lich.close_hour, lich.close_minute,
    lich.day_of_week, lich.hour, lich.minute,
  );
  return note ? `${label} ${note}` : label;
}

// ─── buildDashboard ──────────────────────────────────────────────────────────
async function buildDashboard(guild, cfg, viewMode = 'admin') {
  const notifCh  = await timKenhThongBao(guild);
  const lichList = await db.getLichCoDinh(guild.id);

  const lichLines = lichList.length
    ? lichList.map((l, i) => {
        const mo   = `${TEN_THU[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
        const dong = l.close_day_of_week != null
          ? `${TEN_THU[l.close_day_of_week]} ${pad(l.close_hour)}:${pad(l.close_minute)}`
          : 'không tự đóng';
        return `\`${i+1}\` **${l.session_name}** | ${mo} → ${dong} | <#${l.channel_id}>`;
      }).join('\n')
    : '⚠️ Chưa có lịch cố định';

  if (viewMode === 'user') {
    const embed = new EmbedBuilder()
      .setAuthor(AUTHOR_DEFAULT)
      .setTitle('📋  Thông tin Bot')
      .setDescription('> Chế độ xem thành viên — chỉ hiển thị thông tin cơ bản.')
      .addFields(
        { name: '🔔 Kênh thông báo', value: notifCh ? `<#${notifCh}>` : '_Chưa rõ_', inline: true },
        { name: '🎫 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
        { name: `📅 Lịch cố định (${lichList.length})`, value: lichLines },
      )
      .setColor(0x5865F2)
      .setFooter({ text: `${FOOTER_DEFAULT} • Chế độ xem: Thành viên` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:view:admin').setLabel('🛡️ Chuyển sang Admin View').setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [row], ephemeral: true };
  }

  // Admin view
  const phaiRoleIds = cfg.phai_role_ids ?? [];
  const phaiLines = phaiRoleIds.length
    ? phaiRoleIds.map(id => `<@&${id}>`).join(', ')
    : '⚠️ Chưa cài';

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⚙️  Bảng Điều Khiển — Quản Gia')
    .addFields(
      { name: '🔔 Kênh thông báo', value: notifCh ? `<#${notifCh}>` : '⚠️ Chưa cài', inline: true },
      { name: '🎫 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
      { name: '⚔️ Role phái', value: phaiLines, inline: true },
      { name: `📅 Lịch cố định (${lichList.length})`, value: lichLines },
    )
    .setColor(0x5865F2)
    .setFooter({ text: `${FOOTER_DEFAULT} • Chế độ xem: Admin` })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:channel').setLabel('🔔 Kênh TB').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:role').setLabel('🎫 Role DD').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:phai').setLabel('⚔️ Role Phái').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:view:user').setLabel('👁️ User View').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('📅 Quản lý Lịch').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:preset_menu').setLabel('⚡ Tạo Preset').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

// ─── lichMenuComponents ──────────────────────────────────────────────────────
function lichMenuComponents(lichList) {
  const embed = new EmbedBuilder()
    .setTitle('📅 Quản lý Lịch Cố Định')
    .setDescription(
      lichList.length
        ? lichList.map((l, i) => {
            const mo   = `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
            const dong = l.close_day_of_week != null
              ? `${TEN_THU_FULL[l.close_day_of_week]} ${pad(l.close_hour)}:${pad(l.close_minute)}`
              : 'không tự đóng';
            return `**${i+1}. ${l.session_name}**\nMở: ${mo} | Đóng: ${dong} | <#${l.channel_id}>\nID: \`${l.id}\``;
          }).join('\n\n')
        : '> Chưa có lịch cố định. Nhấn **Thêm** hoặc **Tạo Preset** để bắt đầu.',
    )
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT });

  const rows = [];

  if (lichList.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup:lich:select')
          .setPlaceholder('Chọn lịch để quản lý...')
          .addOptions(lichList.map(l => ({
            label: l.session_name.slice(0, 25),
            description: `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)} | ID: ${l.id.slice(0,8)}`,
            value: l.id,
          }))),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:lich:add').setLabel('➕ Thêm Lịch').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('setup:preset_menu').setLabel('⚡ Tạo Preset').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:dashboard').setLabel('← Bảng điều khiển').setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components: rows, ephemeral: true };
}

// ─── lichActionComponents ─────────────────────────────────────────────────────
function lichActionComponents(lich, lichList, activeSession = null) {
  const { label: moLabel } = ngayThucTe(lich.day_of_week, lich.hour, lich.minute);
  const dongStr = formatDongStr(lich);

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Hành động — ${lich.session_name}`)
    .setDescription([
      `📋 **Tên:** ${lich.session_name}`,
      `⏰ **Mở:** ${moLabel}`,
      `🔒 **Đóng:** ${dongStr}`,
      `📣 **Kênh:** <#${lich.channel_id}>`,
      `🆔 **ID:** \`${lich.id}\``,
      '',
      '> Chọn hành động bên dưới:',
    ].join('\n'))
    .setColor(0xFEE75C)
    .setFooter({ text: FOOTER_DEFAULT });

  const hasActiveSession = !!activeSession;
  // BUG #6 FIX: chỉ enable Đóng Sớm khi có phiên đang mở VÀ lịch có cấu hình tự đóng
  const canEarlyClose = hasActiveSession && lich.close_day_of_week != null;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:lich:early_open:${lich.id}`)
      .setLabel('▶️ Mở Sớm Ngay')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`setup:lich:early_close:${lich.id}`)
      .setLabel('⏹️ Đóng Sớm Ngay')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canEarlyClose),
    // FEAT 1.4: nút Sửa Lịch
    new ButtonBuilder()
      .setCustomId(`setup:lich:edit:${lich.id}`)
      .setLabel('✏️ Sửa Lịch')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`setup:lich:confirm_delete:${lich.id}`)
      .setLabel('🗑️ Xóa Lịch')
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup:lich:menu')
      .setLabel('← Quay lại Danh sách')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

// ─── timKenhThongBao ─────────────────────────────────────────────────────────
async function timKenhThongBao(guild) {
  const cfg = await db.getConfig(guild.id);
  if (cfg?.notification_channel_id) return cfg.notification_channel_id;
  return null;
}

// ─── handleSetupUi ───────────────────────────────────────────────────────────
async function handleSetupUi(interaction) {
  const { guild, member } = interaction;
  if (!guild) return false;

  const cfg = await db.getConfig(guild.id);

  const customId = interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()
    ? interaction.customId
    : interaction.customId ?? '';

  // ── setup:dashboard ──────────────────────────────────────────────────────────
  if (customId === 'setup:dashboard') {
    if (!laAdmin(member, cfg)) {
      await interaction.reply({ content: '🔒 Chỉ admin mới xem được.', ephemeral: true });
      return true;
    }
    const payload = await buildDashboard(guild, cfg, 'admin');
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.update(payload);
    return true;
  }

  // ── setup:view:admin / setup:view:user ───────────────────────────────────────
  if (customId === 'setup:view:admin' || customId === 'setup:view:user') {
    const mode = customId === 'setup:view:admin' ? 'admin' : 'user';
    if (mode === 'admin' && !laAdmin(member, cfg)) {
      await interaction.reply({ content: '🔒 Chỉ admin mới xem được.', ephemeral: true });
      return true;
    }
    const payload = await buildDashboard(guild, cfg, mode);
    await interaction.update(payload);
    return true;
  }

  // ── setup:channel ────────────────────────────────────────────────────────────
  if (customId === 'setup:channel') {
    if (!laAdmin(member, cfg)) { await interaction.reply({ content: '🔒 Chỉ admin.', ephemeral: true }); return true; }
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('setup:channel:select')
        .setPlaceholder('Chọn kênh thông báo...'),
    );
    await interaction.update({ embeds: [], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:channel:select') {
    if (!laAdmin(member, cfg)) return true;
    const channelId = interaction.values[0];
    await db.setConfig(guild.id, { notificationChannelId: channelId });
    const payload = await buildDashboard(guild, await db.getConfig(guild.id), 'admin');
    payload.content = `✅ Đã cài kênh thông báo: <#${channelId}>`;
    await interaction.update(payload);
    return true;
  }

  // ── setup:role ───────────────────────────────────────────────────────────────
  if (customId === 'setup:role') {
    if (!laAdmin(member, cfg)) { await interaction.reply({ content: '🔒 Chỉ admin.', ephemeral: true }); return true; }
    const { StringSelectMenuBuilder: SSM } = require('discord.js');
    await guild.roles.fetch();
    const roles = guild.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .first(25);
    const options = roles.map(r => ({ label: r.name.slice(0,25), value: r.id }));
    if (!options.length) {
      await interaction.reply({ content: '⚠️ Không tìm thấy role nào.', ephemeral: true });
      return true;
    }
    const row = new ActionRowBuilder().addComponents(
      new SSM().setCustomId('setup:role:select').setPlaceholder('Chọn role điểm danh...').addOptions(options),
    );
    await interaction.update({ embeds: [], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:role:select') {
    if (!laAdmin(member, cfg)) return true;
    const roleId = interaction.values[0];
    await db.setConfig(guild.id, { allowedRoleId: roleId });
    const payload = await buildDashboard(guild, await db.getConfig(guild.id), 'admin');
    payload.content = `✅ Đã cài role điểm danh: <@&${roleId}>`;
    await interaction.update(payload);
    return true;
  }

  // ── setup:phai ───────────────────────────────────────────────────────────────
  if (customId === 'setup:phai') {
    if (!laAdmin(member, cfg)) { await interaction.reply({ content: '🔒 Chỉ admin.', ephemeral: true }); return true; }
    await guild.roles.fetch();
    const roles = guild.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .first(25);
    const options = roles.map(r => ({ label: r.name.slice(0,25), value: r.id }));
    if (!options.length) {
      await interaction.reply({ content: '⚠️ Không tìm thấy role nào.', ephemeral: true });
      return true;
    }
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:phai:select')
        .setPlaceholder('Chọn role phái (có thể chọn nhiều)...')
        .setMinValues(1).setMaxValues(Math.min(options.length, 10))
        .addOptions(options),
    );
    await interaction.update({ embeds: [], components: [row], ephemeral: true });
    return true;
  }

  if (customId === 'setup:phai:select') {
    if (!laAdmin(member, cfg)) return true;
    const roleIds = interaction.values;
    await db.setConfig(guild.id, { phaiRoleIds: roleIds });
    const payload = await buildDashboard(guild, await db.getConfig(guild.id), 'admin');
    payload.content = `✅ Đã cài ${roleIds.length} role phái: ${roleIds.map(id => `<@&${id}>`).join(', ')}`;
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:menu ──────────────────────────────────────────────────────────
  if (customId === 'setup:lich:menu') {
    if (!laAdmin(member, cfg)) { await interaction.reply({ content: '🔒 Chỉ admin.', ephemeral: true }); return true; }
    const lichList = await db.getLichCoDinh(guild.id);
    const payload  = lichMenuComponents(lichList);
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.update(payload);
    return true;
  }

  // ── setup:lich:select ────────────────────────────────────────────────────────
  if (customId === 'setup:lich:select') {
    if (!laAdmin(member, cfg)) return true;
    const lichId  = interaction.values[0];
    const lichList = await db.getLichCoDinh(guild.id);
    const lich    = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.update({ content: '❌ Không tìm thấy lịch.', embeds: [], components: [] }); return true; }
    // BUG #6 FIX: lấy activeSession truyền vào lichActionComponents
    const activeSession = await db.getActiveSession(guild.id);
    await interaction.update(lichActionComponents(lich, lichList, activeSession));
    return true;
  }

  // ── setup:preset_menu ────────────────────────────────────────────────────────
  if (customId === 'setup:preset_menu') {
    if (!laAdmin(member, cfg)) { await interaction.reply({ content: '🔒 Chỉ admin.', ephemeral: true }); return true; }

    const embed = new EmbedBuilder()
      .setTitle('⚡ Chọn Preset Lịch')
      .setDescription('Chọn một preset bên dưới để tạo nhanh lịch cố định.\nBạn có thể tùy chỉnh thêm sau khi tạo.')
      .setColor(0x57F287)
      .setFooter({ text: FOOTER_DEFAULT });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:preset:select')
        .setPlaceholder('Chọn preset...')
        .addOptions(PRESETS.map(p => ({ label: p.label, description: p.description, value: p.value }))),
    );

    const rowBack = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({ embeds: [embed], components: [row, rowBack], ephemeral: true });
    return true;
  }

  // ── FEAT 1.3: setup:preset:select ────────────────────────────────────────────
  if (customId === 'setup:preset:select') {
    if (!laAdmin(member, cfg)) return true;
    const chosen = PRESETS.find(p => p.value === interaction.values[0]);
    if (!chosen) { await interaction.update({ content: '❌ Preset không hợp lệ.', embeds: [], components: [] }); return true; }

    if (!chosen.data) {
      // Tùy chỉnh → show add modal
      return handleShowAddModal(interaction);
    }

    // Preset có data → cho chọn kênh
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`setup:preset:kenh:${chosen.value}`)
        .setPlaceholder(`Chọn kênh cho "${chosen.label}"...`),
    );
    const rowFallback = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup:preset_bc:save:${chosen.value}`)
        .setLabel('✅ Tạo Ngay (dùng kênh hiện tại)')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('setup:preset_menu').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setTitle(`⚡ ${chosen.label}`)
      .setDescription(
        `**Mở:** ${TEN_THU_FULL[chosen.data.day_of_week]} ${pad(chosen.data.hour)}:${pad(chosen.data.minute)}\n` +
        `**Đóng:** ${TEN_THU_FULL[chosen.data.close_day_of_week]} ${pad(chosen.data.close_hour)}:${pad(chosen.data.close_minute)}\n\n` +
        `Chọn kênh bên dưới hoặc nhấn **Tạo Ngay** để dùng kênh hiện tại.`,
      )
      .setColor(0x57F287)
      .setFooter({ text: FOOTER_DEFAULT });

    await interaction.update({ embeds: [embed], components: [row, rowFallback], ephemeral: true });
    return true;
  }

  // ── FEAT 1.3: setup:preset:kenh:<value> — chọn kênh xong ──────────────────
  if (customId.startsWith('setup:preset:kenh:')) {
    const presetValue = customId.replace('setup:preset:kenh:', '');
    const chosen = PRESETS.find(p => p.value === presetValue);
    if (!chosen || !chosen.data) { await interaction.update({ content: '❌ Preset không hợp lệ.', embeds: [], components: [] }); return true; }
    const channelId = interaction.values[0];
    await createPresetLich(interaction, guild, chosen, channelId);
    return true;
  }

  // ── FEAT 1.3: setup:preset_bc:save:<value> — dùng kênh hiện tại ──────────
  if (customId.startsWith('setup:preset_bc:save:')) {
    const presetValue = customId.replace('setup:preset_bc:save:', '');
    const chosen = PRESETS.find(p => p.value === presetValue);
    if (!chosen || !chosen.data) { await interaction.update({ content: '❌ Preset không hợp lệ.', embeds: [], components: [] }); return true; }
    const channelId = interaction.channel?.id;
    if (!channelId) {
      await interaction.update({ content: '❌ Không xác định được kênh hiện tại.', embeds: [], components: [] });
      return true;
    }
    await createPresetLich(interaction, guild, chosen, channelId);
    return true;
  }

  // ── setup:lich:early_open:<id> ───────────────────────────────────────────────
  if (customId.startsWith('setup:lich:early_open:')) {
    const lichId = customId.replace('setup:lich:early_open:', '');
    await interaction.deferReply({ ephemeral: true });

    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.editReply({ content: '❌ Không tìm thấy lịch.' }); return true; }

    const existing = await db.getActiveSession(guild.id);
    if (existing) {
      await interaction.editReply({ content: `⚠️ Đang có phiên **${existing.session_name}** đang mở. Vui lòng đóng phiên đó trước.` });
      return true;
    }

    try {
      const { runLichNgay } = require('../utils/scheduler.js');
      await runLichNgay(interaction.client, guild.id, lich);
      await interaction.editReply({ content: `▶️ Đã **mở sớm** phiên **${lich.session_name}** trong <#${lich.channel_id}>!` });
    } catch (e) {
      console.error('[SetupUI] early_open error:', e.message);
      await interaction.editReply({ content: `❌ Lỗi khi mở sớm: ${e.message}` });
    }
    return true;
  }

  // ── setup:lich:early_close:<id> ─────────────────────────────────────────────
  if (customId.startsWith('setup:lich:early_close:')) {
    const lichId = customId.replace('setup:lich:early_close:', '');
    await interaction.deferReply({ ephemeral: true });

    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) { await interaction.editReply({ content: '❌ Không tìm thấy lịch.' }); return true; }
    // BUG #6 FIX: lịch không có cấu hình tự đóng → không cho đóng sớm
    if (lich.close_day_of_week == null) {
      await interaction.editReply({ content: `❌ Lịch **${lich.session_name}** không có cấu hình tự đóng — không thể dùng Đóng Sớm.` });
      return true;
    }

    try {
      const { runDongLichNgay } = require('../utils/scheduler.js');
      await runDongLichNgay(interaction.client, guild.id, lich);
      await interaction.editReply({ content: `⏹️ Đã **đóng sớm** phiên **${lich.session_name}** và gửi thống kê!` });
    } catch (e) {
      console.error('[SetupUI] early_close error:', e.message);
      await interaction.editReply({ content: `❌ Lỗi khi đóng sớm: ${e.message}` });
    }
    return true;
  }

  // ── FEAT 1.4: setup:lich:edit:<id> — mở modal sửa lịch ────────────────────
  if (customId.startsWith('setup:lich:edit:') && !customId.includes(':modal:')) {
    const lichId   = customId.replace('setup:lich:edit:', '');
    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.reply({ content: '❌ Không tìm thấy lịch.', ephemeral: true });
      return true;
    }

    const moStr   = `${TEN_THU[lich.day_of_week]} ${pad(lich.hour)}:${pad(lich.minute)}`;
    const dongStr = lich.close_day_of_week != null
      ? `${TEN_THU[lich.close_day_of_week]} ${pad(lich.close_hour)}:${pad(lich.close_minute)}`
      : '';

    const modal = new ModalBuilder()
      .setCustomId(`setup:lich:edit:modal:${lichId}`)
      .setTitle(`✏️ Sửa Lịch — ${lich.session_name.slice(0, 30)}`);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ten')
          .setLabel('Tên phiên')
          .setStyle(TextInputStyle.Short)
          .setValue(lich.session_name)
          .setRequired(true).setMaxLength(50),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_mo')
          .setLabel('Thứ & Giờ MỞ — format: T7 21:00')
          .setStyle(TextInputStyle.Short)
          .setValue(moStr)
          .setRequired(true).setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_dong')
          .setLabel('Thứ & Giờ ĐÓNG — để trống = không tự đóng')
          .setStyle(TextInputStyle.Short)
          .setValue(dongStr)
          .setRequired(false).setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('kenh_id')
          .setLabel('Channel ID — để trống = giữ nguyên')
          .setStyle(TextInputStyle.Short)
          .setValue(lich.channel_id ?? '')
          .setRequired(false).setMaxLength(20),
      ),
    );

    await interaction.showModal(modal);
    return true;
  }

  // ── FEAT 1.4: setup:lich:edit:modal:<id> — submit modal sửa ───────────────
  if (customId.startsWith('setup:lich:edit:modal:')) {
    const lichId = customId.replace('setup:lich:edit:modal:', '');
    await interaction.deferReply({ ephemeral: true });

    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.editReply({ content: '❌ Không tìm thấy lịch.' });
      return true;
    }

    const ten     = interaction.fields.getTextInputValue('ten').trim();
    const moRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const dongRaw = interaction.fields.getTextInputValue('gio_dong').trim();
    const kenhRaw = interaction.fields.getTextInputValue('kenh_id').trim();

    const parsed = parseThuGio(moRaw);
    if (!parsed) {
      await interaction.editReply({ content: '❌ Định dạng giờ mở không hợp lệ. Dùng: `T7 21:00`' });
      return true;
    }

    let parsedDong = null;
    if (dongRaw) {
      parsedDong = parseThuGio(dongRaw);
      if (!parsedDong) {
        await interaction.editReply({ content: '❌ Định dạng giờ đóng không hợp lệ.' });
        return true;
      }
    }

    const channelId = kenhRaw || lich.channel_id;
    if (kenhRaw) {
      const ch = guild.channels.cache.get(kenhRaw) || await guild.channels.fetch(kenhRaw).catch(() => null);
      if (!ch) {
        await interaction.editReply({ content: `❌ Không tìm thấy kênh ID \`${kenhRaw}\`.` });
        return true;
      }
    }

    // FEAT 1.4: gọi db.capNhatLichCoDinh thay vì xóa + tạo lại
    const updated = await db.capNhatLichCoDinh(guild.id, lichId, {
      sessionName:    ten,
      dayOfWeek:      parsed.thu,
      hour:           parsed.gio,
      minute:         parsed.phut,
      closeDayOfWeek: parsedDong?.thu  ?? null,
      closeHour:      parsedDong?.gio  ?? null,
      closeMinute:    parsedDong?.phut ?? null,
      channelId,
    });

    if (!updated) {
      await interaction.editReply({ content: '❌ Cập nhật thất bại.' });
      return true;
    }

    // Reschedule timer
    try {
      const { cancelLichCoDinh, scheduleLichCoDinh } = require('../utils/scheduler.js');
      cancelLichCoDinh(guild.id, lichId);
      await scheduleLichCoDinh(interaction.client, guild, updated);
    } catch (e) {
      console.warn('[SetupUI] reschedule sau edit thất bại:', e.message);
    }

    const { label: moLabel } = ngayThucTe(parsed.thu, parsed.gio, parsed.phut);
    const dongDisplay = parsedDong
      ? (() => {
          const { label, note } = ngayThucTe(parsedDong.thu, parsedDong.gio, parsedDong.phut, parsed.thu, parsed.gio, parsed.phut);
          return note ? `${label} ${note}` : label;
        })()
      : 'Không tự đóng';

    await interaction.editReply({
      content: [
        `✅ Đã cập nhật lịch **${ten}**`,
        `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`,
        `Kênh: <#${channelId}> | ID: \`${lichId}\``,
      ].join('\n'),
    });
    return true;
  }

  // ── setup:lich:confirm_delete:<id> ──────────────────────────────────────────
  if (customId.startsWith('setup:lich:confirm_delete:')) {
    const lichId   = customId.replace('setup:lich:confirm_delete:', '');
    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    const ten      = lich?.session_name ?? lichId.slice(0,8);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Xác nhận xóa lịch')
      .setDescription(`Bạn có chắc muốn xóa lịch **${ten}**?\n> Hành động này không thể hoàn tác.`)
      .setColor(0xED4245)
      .setFooter({ text: FOOTER_DEFAULT });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:lich:delete:${lichId}`).setLabel('✅ Xác nhận Xóa').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('← Hủy').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  // ── setup:lich:delete:<id> ──────────────────────────────────────────────────
  if (customId.startsWith('setup:lich:delete:')) {
    const lichId = customId.replace('setup:lich:delete:', '');
    await db.xoaLichCoDinh(guild.id, lichId);
    try { const { cancelLichCoDinh } = require('../utils/scheduler.js'); cancelLichCoDinh(guild.id, lichId); } catch (_) {}
    const lichList = await db.getLichCoDinh(guild.id);
    const payload  = lichMenuComponents(lichList);
    payload.content = `🗑️ Đã xóa lịch \`${lichId.slice(0,8)}...\``;
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:add ──────────────────────────────────────────────────────────
  if (customId === 'setup:lich:add') {
    return handleShowAddModal(interaction);
  }

  // ── setup:lich:modal — submit modal thêm mới ────────────────────────────────
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
      dayOfWeek:      parsed.thu,
      hour:           parsed.gio,
      minute:         parsed.phut,
      sessionName:    ten,
      closeDayOfWeek: parsedDong?.thu  ?? null,
      closeHour:      parsedDong?.gio  ?? null,
      closeMinute:    parsedDong?.phut ?? null,
      phaiRoleIds,
      channelId,
    });

    try {
      const { scheduleLichCoDinh } = require('../utils/scheduler.js');
      await scheduleLichCoDinh(interaction.client, guild, lich);
    } catch (e) {
      console.warn('[SetupUI] scheduleLichCoDinh sau add thất bại:', e.message);
    }

    const { label: moLabel } = ngayThucTe(parsed.thu, parsed.gio, parsed.phut);
    const dongDisplay = parsedDong
      ? (() => {
          const { label, note } = ngayThucTe(parsedDong.thu, parsedDong.gio, parsedDong.phut, parsed.thu, parsed.gio, parsed.phut);
          return note ? `${label} ${note}` : label;
        })()
      : 'Không tự đóng';

    await interaction.editReply({
      content: [
        `✅ Đã thêm lịch **${ten}**`,
        `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`,
        `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
      ].join('\n'),
    });
    return true;
  }

  return false;
}

// ─── Helper: hiển thị modal thêm lịch ────────────────────────────────────────
async function handleShowAddModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('setup:lich:modal')
    .setTitle('➕ Thêm Lịch Cố Định');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ten').setLabel('Tên phiên (vd: Bang Chiến, Hội Đồng...)')
        .setStyle(TextInputStyle.Short).setPlaceholder('Bang Chiến')
        .setRequired(true).setMaxLength(50),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gio_mo').setLabel('Thứ & Giờ MỞ — format: T7 21:00')
        .setStyle(TextInputStyle.Short).setPlaceholder('CN T2 T3 T4 T5 T6 T7 — vd: T7 21:00')
        .setRequired(true).setMaxLength(10),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('gio_dong').setLabel('Thứ & Giờ ĐÓNG — để trống = không tự đóng')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('vd: T7 23:30  |  CN 02:00  |  (cùng ngày hoặc khác ngày đều được)')
        .setRequired(false).setMaxLength(10),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('kenh_id').setLabel('Channel ID — để trống = kênh hiện tại')
        .setStyle(TextInputStyle.Short).setPlaceholder('Chuột phải kênh → Copy ID  (vd: 1234567890123456789)')
        .setRequired(false).setMaxLength(20),
    ),
  );

  await interaction.showModal(modal);
  return true;
}

// ─── FEAT 1.3: Tạo lịch từ preset bất kỳ ────────────────────────────────────
async function createPresetLich(interaction, guild, preset, channelId) {
  const cfg         = await db.getConfig(guild.id);
  const phaiRoleIds = cfg.phai_role_ids ?? [];
  const d           = preset.data;

  const lich = await db.themLichCoDinh(guild.id, {
    dayOfWeek:      d.day_of_week,
    hour:           d.hour,
    minute:         d.minute,
    sessionName:    preset.label.replace(/^[^a-zA-ZÀ-ỹ0-9]+/, '').trim(), // bỏ emoji prefix
    closeDayOfWeek: d.close_day_of_week ?? null,
    closeHour:      d.close_hour ?? null,
    closeMinute:    d.close_minute ?? null,
    phaiRoleIds,
    channelId,
  });

  const { scheduleLichCoDinh } = require('../utils/scheduler.js');
  await scheduleLichCoDinh(interaction.client, guild, lich);

  const cfgFresh = await db.getConfig(guild.id);
  const payload  = await buildDashboard(guild, cfgFresh, 'admin');

  const { label: moLabel } = ngayThucTe(d.day_of_week, d.hour, d.minute);
  const { label: dongLabel, note: dongNote } = ngayThucTe(
    d.close_day_of_week, d.close_hour, d.close_minute,
    d.day_of_week, d.hour, d.minute,
  );
  const dongDisplay = dongNote ? `${dongLabel} ${dongNote}` : dongLabel;

  payload.content = [
    `⚡ Đã tạo preset **${preset.label}**!`,
    `Mở: **${moLabel}** → Đóng: **${dongDisplay}**`,
    `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
  ].join('\n');

  if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
  else await interaction.followUp({ ...payload, ephemeral: true });
}

// ─── Parse "T7 21:00" ────────────────────────────────────────────────────────
function parseThuGio(raw) {
  const m = raw.trim().toUpperCase().match(/^(CN|T[2-7])\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const thuMap = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
  const thu  = thuMap[m[1]];
  const gio  = parseInt(m[2], 10);
  const phut = parseInt(m[3], 10);
  if (gio < 0 || gio > 23 || phut < 0 || phut > 59) return null;
  return { thu, gio, phut };
}

module.exports = { handleSetupUi, buildDashboard };
