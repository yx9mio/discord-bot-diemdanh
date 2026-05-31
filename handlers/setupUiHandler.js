// handlers/setupUiHandler.js
// Xử lý toàn bộ interaction từ Setup UI Wizard
// customId convention: setup:<action>[:<payload>]

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  TextInputStyle, EmbedBuilder, PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const db = require('../db.js');
const { FOOTER_DEFAULT, AUTHOR_DEFAULT } = require('../utils/embeds.js');
const { timKenhThongBao } = require('../utils/helpers.js');

// ─── Hằng số ────────────────────────────────────────────────────────────────
const TEN_THU = ['CN','T2','T3','T4','T5','T6','T7'];
const TEN_THU_FULL = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const pad = n => String(n ?? 0).padStart(2, '0');

// ─── Build UI helpers ────────────────────────────────────────────────────────

async function buildDashboard(guild, cfg, viewMode = 'admin') {
  const notifCh = await timKenhThongBao(guild);
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

  // ── User view (chế độ xem thành viên) ──────────────────────────────────────
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

  // ── Admin view (mặc định) ───────────────────────────────────────────────────
  const missing = [];
  if (!cfg.allowed_role_id || !cfg.admin_role_id) missing.push('• Role điểm danh & admin chưa cài');
  if (!cfg.phai_role_ids?.length) missing.push('• Phái chưa cài');
  if (!lichList.length) missing.push('• Chưa có lịch cố định');

  const embed = new EmbedBuilder()
    .setAuthor(AUTHOR_DEFAULT)
    .setTitle('⚙️  Bot Setup Dashboard')
    .setDescription(missing.length
      ? `> ⚠️ Còn ${missing.length} mục cần hoàn thiện:\n${missing.join('\n')}`
      : '> ✅ Cấu hình hoàn chỉnh!')
    .addFields(
      { name: '🔔 Kênh thông báo', value: notifCh ? `<#${notifCh}>` : '_Chưa rõ_', inline: true },
      { name: '🎫 Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '⚠️ Chưa cài', inline: true },
      { name: '🛡️ Role admin bot', value: cfg.admin_role_id ? `<@&${cfg.admin_role_id}>` : '⚠️ Chưa cài', inline: true },
      {
        name: `🏆 Phái (${cfg.phai_role_ids?.length ?? 0})`,
        value: cfg.phai_role_ids?.length
          ? cfg.phai_role_ids.slice(0, 15).map(id => `<@&${id}>`).join(' ') +
            (cfg.phai_role_ids.length > 15 ? ` +${cfg.phai_role_ids.length - 15}` : '')
          : '⚠️ Chưa cài phái',
      },
      { name: `📅 Lịch cố định (${lichList.length})`, value: lichLines },
    )
    .setColor(missing.length ? 0xFEE75C : 0x57F287)
    .setFooter({ text: `${FOOTER_DEFAULT} • Chế độ xem: Admin` })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:role').setLabel('🎫 Cài Role').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:phai').setLabel('🏆 Cài Phái').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('📅 Quản lý Lịch').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:preset_bc').setLabel('⚡ Preset Bang Chiến').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:refresh').setLabel('🔄 Làm mới').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:view:user').setLabel('👁️ User View').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2], ephemeral: true };
}

function lichMenuComponents(lichList) {
  const embed = new EmbedBuilder()
    .setTitle('📅 Quản lý Lịch Cố Định')
    .setDescription(lichList.length
      ? lichList.map((l, i) => {
          const mo = `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)}`;
          const dong = l.close_day_of_week != null
            ? `${TEN_THU_FULL[l.close_day_of_week]} ${pad(l.close_hour)}:${pad(l.close_minute)}`
            : 'Không tự đóng';
          return `**${i+1}. ${l.session_name}**\nMở: ${mo} | Đóng: ${dong} | <#${l.channel_id}>\nID: \`${l.id}\``;
        }).join('\n\n')
      : '_Chưa có lịch nào._')
    .setColor(0x5865F2)
    .setFooter({ text: FOOTER_DEFAULT });

  const rows = [];

  // Nút Thêm lịch + Preset
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup:lich:add').setLabel('➕ Thêm lịch mới').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:preset_bc').setLabel('⚡ Preset Bang Chiến').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup:home').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
  ));

  // Nếu có lịch → select để xóa
  if (lichList.length) {
    const options = lichList.map((l, i) => ({
      label: `${i+1}. ${l.session_name}`,
      description: `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)} | ID: ${l.id.slice(0,8)}`,
      value: l.id,
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:lich:delete')
        .setPlaceholder('🗑️ Chọn lịch để xóa...')
        .addOptions(options),
    ));
  }

  return { embeds: [embed], components: rows, ephemeral: true };
}

// ─── Guard quyền admin ───────────────────────────────────────────────────────
// FIX BUG #2: kiểm tra cả Discord Administrator VÀ admin_role_id từ config
async function isAdmin(member, cfg) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg?.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleSetupUi(interaction) {
  const { customId, guild, member } = interaction;

  // Chỉ xử lý customId bắt đầu bằng 'setup:'
  if (!customId?.startsWith('setup:')) return false;

  // Guard quyền — FIX BUG #2: load cfg trước để check admin_role_id
  const cfg = await db.getConfig(guild.id);
  if (!(await isAdmin(member, cfg))) {
    await interaction.reply({ content: '🔒 Bạn cần có **quyền Quản trị viên** hoặc **Role Admin Bot** để dùng setup.', ephemeral: true });
    return true;
  }

  // ── setup:view:user / setup:view:admin — toggle chế độ xem ─────────────────
  if (customId === 'setup:view:user') {
    const payload = await buildDashboard(guild, cfg, 'user');
    await interaction.update(payload);
    return true;
  }

  if (customId === 'setup:view:admin') {
    const payload = await buildDashboard(guild, cfg, 'admin');
    await interaction.update(payload);
    return true;
  }

  // ── setup:home / setup:refresh ──────────────────────────────────────────────
  if (customId === 'setup:home' || customId === 'setup:refresh') {
    const cfgFresh = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfgFresh, 'admin');
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.update(payload);
    }
    return true;
  }

  // ── setup:role — mở Select chọn role ────────────────────────────────────────
  if (customId === 'setup:role') {
    const embed = new EmbedBuilder()
      .setTitle('🎫 Cài Role')
      .setDescription(
        '**Bước 1:** Chọn **Role Điểm Danh** (role của thành viên được điểm danh)\n' +
        '**Bước 2:** Chọn **Role Admin Bot** (role có quyền mở/đóng phiên)\n\n' +
        'Dùng 2 menu bên dưới rồi bấm **✅ Lưu Role**.')
      .addFields(
        { name: 'Hiện tại — Role điểm danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : '_Chưa cài_', inline: true },
        { name: 'Hiện tại — Role admin bot',  value: cfg.admin_role_id   ? `<@&${cfg.admin_role_id}>`   : '_Chưa cài_', inline: true },
      )
      .setColor(0x5865F2)
      .setFooter({ text: FOOTER_DEFAULT });

    const rows = [
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup:role:select_allowed')
          .setPlaceholder('① Chọn Role Điểm Danh...')
          .setMinValues(1).setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup:role:select_admin')
          .setPlaceholder('② Chọn Role Admin Bot...')
          .setMinValues(1).setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:role:save').setLabel('✅ Lưu Role').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:home').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
      ),
    ];

    await interaction.update({ embeds: [embed], components: rows, ephemeral: true });
    return true;
  }

  // ── setup:role:select_allowed / select_admin — ghi vào cfg tạm ────────────
  if (customId === 'setup:role:select_allowed') {
    const roleId = interaction.values[0];
    await db.setConfig(guild.id, { allowed_role_id: roleId });
    await interaction.reply({ content: `✅ Đã chọn **Role Điểm Danh**: <@&${roleId}>. Bây giờ chọn tiếp Role Admin Bot rồi bấm Lưu.`, ephemeral: true });
    return true;
  }

  if (customId === 'setup:role:select_admin') {
    const roleId = interaction.values[0];
    await db.setConfig(guild.id, { admin_role_id: roleId });
    await interaction.reply({ content: `✅ Đã chọn **Role Admin Bot**: <@&${roleId}>. Bấm **Lưu Role** để hoàn tất.`, ephemeral: true });
    return true;
  }

  // ── setup:role:save — refresh dashboard ────────────────────────────────────
  if (customId === 'setup:role:save') {
    const cfgFresh = await db.getConfig(guild.id);
    const ok = cfgFresh.allowed_role_id && cfgFresh.admin_role_id;
    const payload = await buildDashboard(guild, cfgFresh, 'admin');
    payload.content = ok
      ? `✅ Đã lưu role!  Role điểm danh: <@&${cfgFresh.allowed_role_id}> | Admin: <@&${cfgFresh.admin_role_id}>`
      : '⚠️ Chưa chọn đủ cả 2 role — vui lòng chọn lại.';
    await interaction.update(payload);
    return true;
  }

  // ── setup:phai — mở Role Select nhiều giá trị ────────────────────────────────
  if (customId === 'setup:phai') {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Cài Phái')
      .setDescription(
        'Chọn **tối đa 10 role phái** từ menu bên dưới, sau đó bấm **✅ Lưu Phái**.\n' +
        '> Các role phái dùng để phân loại điểm danh theo từng phái trong server.')
      .addFields({
        name: `Hiện tại (${cfg.phai_role_ids?.length ?? 0} phái)`,
        value: cfg.phai_role_ids?.length
          ? cfg.phai_role_ids.map(id => `<@&${id}>`).join(' ')
          : '_Chưa cài_',
      })
      .setColor(0xF1C40F)
      .setFooter({ text: FOOTER_DEFAULT });

    const rows = [
      new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup:phai:select')
          .setPlaceholder('Chọn các role phái (tối đa 10)...')
          .setMinValues(1).setMaxValues(10),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:home').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
      ),
    ];

    await interaction.update({ embeds: [embed], components: rows, ephemeral: true });
    return true;
  }

  // ── setup:phai:select — lưu phái và refresh dashboard ──────────────────────
  if (customId === 'setup:phai:select') {
    const phaiRoleIds = interaction.values;
    await db.setConfig(guild.id, { phai_role_ids: phaiRoleIds });
    const cfgFresh = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfgFresh, 'admin');
    payload.content = `✅ Đã lưu **${phaiRoleIds.length}** phái: ${phaiRoleIds.map(id => `<@&${id}>`).join(' ')}`;
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:menu — màn quản lý lịch ─────────────────────────────────────
  if (customId === 'setup:lich:menu') {
    const lichList = await db.getLichCoDinh(guild.id);
    const payload = lichMenuComponents(lichList);
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:add — mở Modal nhập thông tin lịch ─────────────────────────
  if (customId === 'setup:lich:add') {
    const modal = new ModalBuilder()
      .setCustomId('setup:lich:modal')
      .setTitle('➕ Thêm Lịch Cố Định');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ten')
          .setLabel('Tên phiên (vd: Bang Chiến)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(50),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_mo')
          .setLabel('Thứ & Giờ MỞ — format: T7 21:00')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('T2-T7 hoặc CN, giờ:phút — vd: T7 21:00')
          .setRequired(true).setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('gio_dong')
          .setLabel('Thứ & Giờ ĐÓNG — để trống nếu không tự đóng')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('vd: T7 19:30  (tuần sau nếu trùng/trước giờ mở)')
          .setRequired(false).setMaxLength(10),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('kenh_id')
          .setLabel('Channel ID (để trống = dùng kênh hiện tại khi /setup)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('vd: 1234567890123456789')
          .setRequired(false).setMaxLength(20),
      ),
    );

    await interaction.showModal(modal);
    return true;
  }

  // ── setup:lich:modal — submit modal, lưu lịch ────────────────────────────────
  if (customId === 'setup:lich:modal') {
    await interaction.deferReply({ ephemeral: true });
    const ten     = interaction.fields.getTextInputValue('ten').trim();
    const moRaw   = interaction.fields.getTextInputValue('gio_mo').trim();
    const dongRaw = interaction.fields.getTextInputValue('gio_dong').trim();
    const kenhRaw = interaction.fields.getTextInputValue('kenh_id').trim();

    const parsed = parseThuGio(moRaw);
    if (!parsed) {
      return interaction.editReply({ content: '❌ Định dạng giờ mở không hợp lệ. Dùng: `T7 21:00` hoặc `CN 08:30`' });
    }

    let parsedDong = null;
    if (dongRaw) {
      parsedDong = parseThuGio(dongRaw);
      if (!parsedDong) {
        return interaction.editReply({ content: '❌ Định dạng giờ đóng không hợp lệ. Dùng: `T7 19:30` hoặc để trống.' });
      }
    }

    const channelId = kenhRaw || interaction.channel?.id;
    if (!channelId) {
      return interaction.editReply({ content: '❌ Không xác định được kênh. Vui lòng nhập Channel ID.' });
    }

    const cfgCurrent = await db.getConfig(guild.id);
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

    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild, lich);

    const moStr   = `${TEN_THU_FULL[parsed.thu]} ${pad(parsed.gio)}:${pad(parsed.phut)}`;
    const dongStr = parsedDong ? `${TEN_THU_FULL[parsedDong.thu]} ${pad(parsedDong.gio)}:${pad(parsedDong.phut)}` : 'Không tự đóng';
    return interaction.editReply({
      content: [
        `✅ Đã thêm lịch **${ten}**`,
        `Mở: **${moStr}** → Đóng: **${dongStr}**`,
        `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
      ].join('\n'),
    });
  }

  // ── setup:lich:delete — xóa lịch đã chọn ───────────────────────────────────
  // FIX BUG #1: truyền cả guild.id vào xoaLichCoDinh (trước đây thiếu guildId)
  if (customId === 'setup:lich:delete') {
    const lichId = interaction.values[0];
    await db.xoaLichCoDinh(guild.id, lichId);
    const lichList = await db.getLichCoDinh(guild.id);
    const payload = lichMenuComponents(lichList);
    payload.content = `🗑️ Đã xóa lịch \`${lichId.slice(0,8)}...\``;
    await interaction.update(payload);
    return true;
  }

  // ── setup:preset_bc — preset Bang Chiến ─────────────────────────────────────
  if (customId === 'setup:preset_bc') {
    const embed = new EmbedBuilder()
      .setTitle('⚡ Preset Bang Chiến')
      .setDescription(
        '**Lịch:** Thứ bảy 21:00 → Thứ bảy 19:30 (tuần sau)\n\n' +
        'Chọn kênh thông báo rồi bấm **✅ Tạo Ngay**.')
      .setColor(0xED4245)
      .setFooter({ text: FOOTER_DEFAULT });

    const rows = [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup:preset_bc:kenh')
          .setPlaceholder('Chọn kênh gửi thông báo...')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('setup:preset_bc:save').setLabel('✅ Tạo Ngay (dùng kênh hiện tại)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('setup:lich:menu').setLabel('← Quay lại').setStyle(ButtonStyle.Secondary),
      ),
    ];

    await interaction.update({ embeds: [embed], components: rows, ephemeral: true });
    return true;
  }

  // ── setup:preset_bc:kenh — chọn kênh rồi lưu ngay ─────────────────────────
  if (customId === 'setup:preset_bc:kenh') {
    await interaction.deferReply({ ephemeral: true });
    const channelId = interaction.values[0];
    await createPresetBangChien(interaction, guild, channelId);
    return true;
  }

  // ── setup:preset_bc:save — dùng kênh hiện tại ────────────────────────────────
  if (customId === 'setup:preset_bc:save') {
    await interaction.deferUpdate();
    const channelId = interaction.channel?.id;
    if (!channelId) {
      await interaction.followUp({ content: '❌ Không xác định kênh. Dùng menu chọn kênh ở trên.', ephemeral: true });
      return true;
    }
    await createPresetBangChien(interaction, guild, channelId);
    return true;
  }

  return false; // customId 'setup:' nhưng không match → bỏ qua
}

// ─── Tạo preset Bang Chiến ──────────────────────────────────────────────────
async function createPresetBangChien(interaction, guild, channelId) {
  const cfg = await db.getConfig(guild.id);
  const phaiRoleIds = cfg.phai_role_ids ?? [];

  const lich = await db.themLichCoDinh(guild.id, {
    dayOfWeek: 6, hour: 21, minute: 0,
    sessionName: 'Bang Chiến',
    closeDayOfWeek: 6, closeHour: 19, closeMinute: 30,
    phaiRoleIds,
    channelId,
  });

  const { scheduleLichCoDinh } = require('../utils/scheduler.js');
  await scheduleLichCoDinh(interaction.client, guild, lich);

  const cfgFresh = await db.getConfig(guild.id);
  const payload = await buildDashboard(guild, cfgFresh, 'admin');
  payload.content = [
    `⚡ Preset **Bang Chiến** đã được tạo!`,
    `Mở: Thứ bảy 21:00 → Đóng: Thứ bảy 19:30 (tuần sau) | Kênh: <#${channelId}>`,
    phaiRoleIds.length ? '' : '\n⚠️ Chưa cài phái — vào **🏆 Cài Phái** để hoàn thiện.',
  ].filter(Boolean).join('\n');

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.update(payload);
  }
}

// ─── Parse chuỗi "T7 21:00" → { thu, gio, phut } ─────────────────────────────
const THU_PARSE = {
  'cn': 0, 'chu_nhat': 0,
  't2': 1, 'thu_hai': 1, 'thứ_hai': 1,
  't3': 2, 'thu_ba': 2,  'thứ_ba': 2,
  't4': 3, 'thu_tu': 3,  'thứ_tư': 3,
  't5': 4, 'thu_nam': 4, 'thứ_năm': 4,
  't6': 5, 'thu_sau': 5, 'thứ_sáu': 5,
  't7': 6, 'thu_bay': 6, 'thứ_bảy': 6,
};

function parseThuGio(raw) {
  if (!raw) return null;
  const parts = raw.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const thuKey = parts[0].replace(/[^a-z0-9]/g, '_');
  const thu = THU_PARSE[thuKey];
  if (thu === undefined) return null;
  const gioPhut = parts[1].split(':');
  if (gioPhut.length < 2) return null;
  const gio  = parseInt(gioPhut[0], 10);
  const phut = parseInt(gioPhut[1], 10);
  if (isNaN(gio) || isNaN(phut) || gio < 0 || gio > 23 || phut < 0 || phut > 59) return null;
  return { thu, gio, phut };
}

module.exports = { handleSetupUi, buildDashboard };
