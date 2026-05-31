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

// ─── Tính ngày thực tế sắp tới (giờ VN UTC+7) ───────────────────────────────
// Trả về string "Thứ X, DD/MM/YYYY HH:MM"
function ngayThucTe(dayOfWeek, hour, minute) {
  const VN_OFFSET = 7 * 60 * 60 * 1000;
  const nowVn = new Date(Date.now() + VN_OFFSET);

  const curDay = nowVn.getUTCDay();
  const curH   = nowVn.getUTCHours();
  const curM   = nowVn.getUTCMinutes();

  let daysUntil = (dayOfWeek - curDay + 7) % 7;
  if (daysUntil === 0) {
    const secPassed = curH * 3600 + curM * 60;
    const secTarget = hour * 3600 + minute * 60;
    if (secPassed >= secTarget) daysUntil = 7;
  }

  const target = new Date(nowVn.getTime() + daysUntil * 86400000);
  const dd  = pad(target.getUTCDate());
  const mm  = pad(target.getUTCMonth() + 1);
  const yyyy = target.getUTCFullYear();

  return `${TEN_THU_FULL[dayOfWeek]}, ${dd}/${mm}/${yyyy} ${pad(hour)}:${pad(minute)}`;
}

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

// ─── lichMenuComponents — menu chính quản lý lịch ───────────────────────────
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

  // Nếu có lịch → select để chọn lịch → xem chi tiết hành động
  if (lichList.length) {
    const options = lichList.map((l, i) => ({
      label: `${i+1}. ${l.session_name}`,
      description: `${TEN_THU_FULL[l.day_of_week]} ${pad(l.hour)}:${pad(l.minute)} | ID: ${l.id.slice(0,8)}`,
      value: l.id,
    }));
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup:lich:select')
        .setPlaceholder('⚙️ Chọn lịch để xem hành động...')
        .addOptions(options),
    ));
  }

  return { embeds: [embed], components: rows, ephemeral: true };
}

// ─── lichActionComponents — hiện 3 nút hành động cho 1 lịch ─────────────────
function lichActionComponents(lich, lichList) {
  // Tính ngày thực tế sắp tới
  const moStr   = ngayThucTe(lich.day_of_week, lich.hour, lich.minute);
  const dongStr = lich.close_day_of_week != null
    ? ngayThucTe(lich.close_day_of_week, lich.close_hour, lich.close_minute)
    : 'Không tự đóng';

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Hành động — ${lich.session_name}`)
    .setDescription([
      `📋 **Tên:** ${lich.session_name}`,
      `⏰ **Mở:** ${moStr}`,
      `🔒 **Đóng:** ${dongStr}`,
      `📣 **Kênh:** <#${lich.channel_id}>`,
      `🆔 **ID:** \`${lich.id}\``,
      '',
      '> Chọn hành động bên dưới:',
    ].join('\n'))
    .setColor(0xFEE75C)
    .setFooter({ text: FOOTER_DEFAULT });

  const canClose = lich.close_day_of_week != null;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup:lich:early_open:${lich.id}`)
      .setLabel('▶️ Mở Sớm Ngay')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`setup:lich:early_close:${lich.id}`)
      .setLabel('⏹️ Đóng Sớm Ngay')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canClose),
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

// ─── Guard quyền admin ───────────────────────────────────────────────────────
async function isAdmin(member, cfg) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg?.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handleSetupUi(interaction) {
  const { customId, guild, member } = interaction;

  if (!customId?.startsWith('setup:')) return false;

  const cfg = await db.getConfig(guild.id);
  if (!(await isAdmin(member, cfg))) {
    await interaction.reply({ content: '🔒 Bạn cần có **quyền Quản trị viên** hoặc **Role Admin Bot** để dùng setup.', ephemeral: true });
    return true;
  }

  // ── setup:view:user / setup:view:admin ──────────────────────────────────────
  if (customId === 'setup:view:user') {
    await interaction.update(await buildDashboard(guild, cfg, 'user'));
    return true;
  }
  if (customId === 'setup:view:admin') {
    await interaction.update(await buildDashboard(guild, cfg, 'admin'));
    return true;
  }

  // ── setup:home / setup:refresh ──────────────────────────────────────────────
  if (customId === 'setup:home' || customId === 'setup:refresh') {
    const cfgFresh = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfgFresh, 'admin');
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
    else await interaction.update(payload);
    return true;
  }

  // ── setup:role ──────────────────────────────────────────────────────────────
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

  // ── setup:phai ──────────────────────────────────────────────────────────────
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

  if (customId === 'setup:phai:select') {
    const phaiRoleIds = interaction.values;
    await db.setConfig(guild.id, { phai_role_ids: phaiRoleIds });
    const cfgFresh = await db.getConfig(guild.id);
    const payload = await buildDashboard(guild, cfgFresh, 'admin');
    payload.content = `✅ Đã lưu **${phaiRoleIds.length}** phái: ${phaiRoleIds.map(id => `<@&${id}>`).join(' ')}`;
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:menu ─────────────────────────────────────────────────────────
  if (customId === 'setup:lich:menu') {
    const lichList = await db.getLichCoDinh(guild.id);
    await interaction.update(lichMenuComponents(lichList));
    return true;
  }

  // ── setup:lich:select — chọn lịch → hiện 3 nút hành động ───────────────────
  if (customId === 'setup:lich:select') {
    const lichId   = interaction.values[0];
    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.reply({ content: '❌ Không tìm thấy lịch này.', ephemeral: true });
      return true;
    }
    await interaction.update(lichActionComponents(lich, lichList));
    return true;
  }

  // ── setup:lich:early_open:<id> — mở sớm ngay lập tức ───────────────────────
  if (customId.startsWith('setup:lich:early_open:')) {
    const lichId = customId.replace('setup:lich:early_open:', '');
    await interaction.deferReply({ ephemeral: true });

    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.editReply({ content: '❌ Không tìm thấy lịch.' });
      return true;
    }

    // Kiểm tra đã có phiên đang mở chưa
    const existing = await db.getActiveSession(guild.id);
    if (existing) {
      await interaction.editReply({
        content: `⚠️ Đang có phiên **${existing.session_name}** đang mở. Vui lòng đóng phiên đó trước.`,
      });
      return true;
    }

    try {
      const { runLichNgay } = require('../utils/scheduler.js');
      await runLichNgay(interaction.client, guild.id, lich);
      await interaction.editReply({
        content: `▶️ Đã **mở sớm** phiên **${lich.session_name}** trong <#${lich.channel_id}>!`,
      });
    } catch (e) {
      console.error('[SetupUI] early_open error:', e.message);
      await interaction.editReply({ content: `❌ Lỗi khi mở sớm: ${e.message}` });
    }
    return true;
  }

  // ── setup:lich:early_close:<id> — đóng sớm ngay lập tức ────────────────────
  if (customId.startsWith('setup:lich:early_close:')) {
    const lichId = customId.replace('setup:lich:early_close:', '');
    await interaction.deferReply({ ephemeral: true });

    const lichList = await db.getLichCoDinh(guild.id);
    const lich     = lichList.find(l => l.id === lichId);
    if (!lich) {
      await interaction.editReply({ content: '❌ Không tìm thấy lịch.' });
      return true;
    }

    try {
      const { runDongLichNgay } = require('../utils/scheduler.js');
      await runDongLichNgay(interaction.client, guild.id, lich);
      await interaction.editReply({
        content: `⏹️ Đã **đóng sớm** phiên **${lich.session_name}** và gửi thống kê!`,
      });
    } catch (e) {
      console.error('[SetupUI] early_close error:', e.message);
      await interaction.editReply({ content: `❌ Lỗi khi đóng sớm: ${e.message}` });
    }
    return true;
  }

  // ── setup:lich:confirm_delete:<id> — xác nhận trước khi xóa ─────────────────
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
      new ButtonBuilder()
        .setCustomId(`setup:lich:delete:${lichId}`)
        .setLabel('✅ Xác nhận Xóa')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('setup:lich:menu')
        .setLabel('← Hủy')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({ embeds: [embed], components: [row], ephemeral: true });
    return true;
  }

  // ── setup:lich:delete:<id> — xóa lịch sau khi xác nhận ─────────────────────
  if (customId.startsWith('setup:lich:delete:')) {
    const lichId = customId.replace('setup:lich:delete:', '');
    await db.xoaLichCoDinh(guild.id, lichId);

    // Hủy scheduler nếu đang chạy
    try {
      const { cancelLichCoDinh } = require('../utils/scheduler.js');
      cancelLichCoDinh(guild.id, lichId);
    } catch (_) {}

    const lichList = await db.getLichCoDinh(guild.id);
    const payload  = lichMenuComponents(lichList);
    payload.content = `🗑️ Đã xóa lịch \`${lichId.slice(0,8)}...\``;
    await interaction.update(payload);
    return true;
  }

  // ── setup:lich:add — mở Modal nhập lịch ────────────────────────────────────
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

  // ── setup:lich:modal — submit modal ────────────────────────────────────────
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

    const { scheduleLichCoDinh } = require('../utils/scheduler.js');
    await scheduleLichCoDinh(interaction.client, guild, lich);

    const moStr   = ngayThucTe(parsed.thu, parsed.gio, parsed.phut);
    const dongStr = parsedDong ? ngayThucTe(parsedDong.thu, parsedDong.gio, parsedDong.phut) : 'Không tự đóng';
    return interaction.editReply({
      content: [
        `✅ Đã thêm lịch **${ten}**`,
        `Mở: **${moStr}** → Đóng: **${dongStr}**`,
        `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
      ].join('\n'),
    });
  }

  // ── setup:preset_bc ─────────────────────────────────────────────────────────
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

  if (customId === 'setup:preset_bc:kenh') {
    await interaction.deferReply({ ephemeral: true });
    const channelId = interaction.values[0];
    await createPresetBangChien(interaction, guild, channelId);
    return true;
  }

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

  return false;
}

// ─── Tạo preset Bang Chiến ──────────────────────────────────────────────────
async function createPresetBangChien(interaction, guild, channelId) {
  const cfg         = await db.getConfig(guild.id);
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
  const payload  = await buildDashboard(guild, cfgFresh, 'admin');
  const moStr    = ngayThucTe(6, 21, 0);
  const dongStr  = ngayThucTe(6, 19, 30);
  payload.content = [
    `⚡ Đã tạo preset **Bang Chiến**!`,
    `Mở: **${moStr}** → Đóng: **${dongStr}**`,
    `Kênh: <#${channelId}> | ID: \`${lich.id}\``,
  ].join('\n');

  if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
  else await interaction.followUp({ ...payload, ephemeral: true });
}

// ─── Parse "T7 21:00" hoặc "CN 08:30" ──────────────────────────────────────
function parseThuGio(raw) {
  const m = raw.trim().toUpperCase().match(/^(CN|T[2-7])\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const thuMap = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
  const thu = thuMap[m[1]];
  const gio = parseInt(m[2], 10);
  const phut = parseInt(m[3], 10);
  if (gio < 0 || gio > 23 || phut < 0 || phut > 59) return null;
  return { thu, gio, phut };
}

module.exports = { handleSetupUi, buildDashboard };
