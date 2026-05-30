// ============================================================
// Bot Điểm Danh Discord — Plain JavaScript (CommonJS)
// Compatible với Wispbyte (Node.js, discord.js v14)
// ============================================================
require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, Colors, PermissionFlagsBits,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} = require('discord.js');

const storage = require('./storage.js');
const { buildProgressBar } = require('./utils/progress.js');
const embeds = require('./utils/embeds.js');

// ─── Client ───────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.GuildMember],
});

// ─── Slash Commands Definition ────────────────────────────────
const commands = [
  // Admin
  new SlashCommandBuilder()
    .setName('batdau_diemdanh')
    .setDescription('Mở phiên điểm danh mới')
    .addStringOption(o => o.setName('ten_phien').setDescription('Tên phiên (vd: Raid thứ 7)').setRequired(true))
    .addIntegerOption(o => o.setName('thoi_gian').setDescription('Tự động đóng sau X phút (0 = không tự đóng)').setRequired(false).setMinValue(0).setMaxValue(1440)),

  new SlashCommandBuilder()
    .setName('ket_thuc_diemdanh')
    .setDescription('Kết thúc phiên điểm danh, lưu lịch sử'),

  new SlashCommandBuilder()
    .setName('huy_diemdanh')
    .setDescription('Hủy phiên điểm danh (không lưu lịch sử)'),

  new SlashCommandBuilder()
    .setName('them_diemdanh')
    .setDescription('Thêm thành viên điểm danh thủ công')
    .addUserOption(o => o.setName('member').setDescription('Thành viên cần thêm').setRequired(true))
    .addStringOption(o => o.setName('status').setDescription('Trạng thái').setRequired(true)
      .addChoices(
        { name: '✅ Tham gia', value: 'tham_gia' },
        { name: '❌ Không tham gia', value: 'khong_tham_gia' },
      )),

  new SlashCommandBuilder()
    .setName('xoa_diemdanh')
    .setDescription('Xóa điểm danh của một thành viên')
    .addUserOption(o => o.setName('member').setDescription('Thành viên cần xóa').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sua_diemdanh')
    .setDescription('Sửa status điểm danh (tối đa 5 người)')
    .addUserOption(o => o.setName('member1').setDescription('Thành viên 1').setRequired(true))
    .addStringOption(o => o.setName('status1').setDescription('Status 1').setRequired(true)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member2').setDescription('Thành viên 2').setRequired(false))
    .addStringOption(o => o.setName('status2').setDescription('Status 2').setRequired(false)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member3').setDescription('Thành viên 3').setRequired(false))
    .addStringOption(o => o.setName('status3').setDescription('Status 3').setRequired(false)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member4').setDescription('Thành viên 4').setRequired(false))
    .addStringOption(o => o.setName('status4').setDescription('Status 4').setRequired(false)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member5').setDescription('Thành viên 5').setRequired(false))
    .addStringOption(o => o.setName('status5').setDescription('Status 5').setRequired(false)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không', value: 'khong_tham_gia' })),

  new SlashCommandBuilder()
    .setName('nhac_nho')
    .setDescription('Ping / liệt kê người chưa điểm danh'),

  new SlashCommandBuilder()
    .setName('caidat_role')
    .setDescription('Cài role được phép điểm danh')
    .addRoleOption(o => o.setName('role').setDescription('Role điểm danh').setRequired(true)),

  new SlashCommandBuilder()
    .setName('caidat_admin_role')
    .setDescription('Cài role admin bot')
    .addRoleOption(o => o.setName('role').setDescription('Role admin bot').setRequired(true)),

  new SlashCommandBuilder()
    .setName('caidat_xem')
    .setDescription('Xem cấu hình hiện tại của bot'),

  // Member
  new SlashCommandBuilder()
    .setName('xem_diemdanh')
    .setDescription('Xem danh sách điểm danh phiên hiện tại'),

  new SlashCommandBuilder()
    .setName('lich_su')
    .setDescription('Xem lịch sử các phiên điểm danh đã kết thúc'),

  new SlashCommandBuilder()
    .setName('thong_ke')
    .setDescription('Top 10 thành viên tham gia nhiều nhất'),

  new SlashCommandBuilder()
    .setName('xuat_diemdanh')
    .setDescription('Xuất danh sách điểm danh ra file .txt'),

  new SlashCommandBuilder()
    .setName('xem_lich_su_member')
    .setDescription('Lịch sử cá nhân: tỷ lệ %, streak, huy hiệu')
    .addUserOption(o => o.setName('member').setDescription('Thành viên (để trống = bản thân)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('thong_ke_phien')
    .setDescription('Chi tiết 1 phiên cụ thể từ lịch sử')
    .addIntegerOption(o => o.setName('so_phien').setDescription('Số thứ tự phiên (1 = mới nhất)').setRequired(true).setMinValue(1)),
].map(c => c.toJSON());

// ─── Register Commands ─────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('[Commands] Đang đăng ký slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID || ''), { body: commands });
    console.log('[Commands] Đăng ký thành công!');
  } catch (e) {
    console.error('[Commands] Lỗi đăng ký:', e.message);
  }
}

// ─── Auto-close timers ────────────────────────────────────────
const autoCloseTimers = new Map(); // guildId → { closeTimer, reminderTimer }

function clearTimers(guildId) {
  const t = autoCloseTimers.get(guildId);
  if (!t) return;
  if (t.closeTimer) clearTimeout(t.closeTimer);
  if (t.reminderTimer) clearTimeout(t.reminderTimer);
  autoCloseTimers.delete(guildId);
}

async function scheduleAutoClose(guild, session, channelId, minutes) {
  clearTimers(guild.id);
  const ms = minutes * 60 * 1000;
  const reminderMs = ms - 2 * 60 * 1000; // 2 phút trước

  const timers = {};

  if (reminderMs > 0) {
    timers.reminderTimer = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        if (!ch) return;
        const s = storage.getSession(guild.id);
        if (!s) return;
        const checkedIds = new Set(Object.keys(s.attendees));
        const absentIds = s.eligible_member_ids.filter(id => !checkedIds.has(id));
        if (absentIds.length > 0) {
          const mentions = absentIds.map(id => `<@${id}>`).join(' ');
          await ch.send(`⏰ **Nhắc nhở:** Phiên điểm danh **${s.session_name}** sẽ kết thúc sau 2 phút!\n${mentions}`);
        }
      } catch (e) { console.error('Reminder error:', e.message); }
    }, reminderMs);
  }

  timers.closeTimer = setTimeout(async () => {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      const s = storage.getSession(guild.id);
      if (!s) return;
      storage.endSession(guild.id);
      clearTimers(guild.id);
      const embed = embeds.buildSummaryEmbed(s);
      if (ch) await ch.send({ content: '🔒 **Phiên điểm danh đã tự động kết thúc!**', embeds: [embed] });
      // Badge announcements
      await announceNewBadges(guild, ch, s);
    } catch (e) { console.error('AutoClose error:', e.message); }
  }, ms);

  autoCloseTimers.set(guild.id, timers);
}

// ─── Badge helper ─────────────────────────────────────────────
const BADGE_MILESTONES = [
  { count: 5,   badge: '🌱', label: 'Lính Mới' },
  { count: 10,  badge: '⭐', label: 'Cần Cù' },
  { count: 20,  badge: '🌟', label: 'Chuyên Cần' },
  { count: 30,  badge: '💪', label: 'Kiên Trì' },
  { count: 50,  badge: '🏆', label: 'Huyền Thoại' },
  { count: 100, badge: '👑', label: 'Vua Điểm Danh' },
];

function getBadge(count) {
  let badge = '';
  for (const m of BADGE_MILESTONES) {
    if (count >= m.count) badge = `${m.badge} ${m.label}`;
  }
  return badge;
}

async function announceNewBadges(guild, channel, session) {
  if (!channel) return;
  const msgs = [];
  for (const [uid, entry] of Object.entries(session.attendees)) {
    if (entry.status !== 'tham_gia') continue;
    const stats = storage.getMemberStats(guild.id, uid);
    const oldCount = stats.total - 1;
    for (const m of BADGE_MILESTONES) {
      if (oldCount < m.count && stats.total >= m.count) {
        msgs.push(`🎉 <@${uid}> đã đạt huy hiệu **${m.badge} ${m.label}** (${m.count} lần tham gia)!`);
      }
    }
  }
  if (msgs.length > 0) {
    await channel.send(msgs.join('\n')).catch(() => null);
  }
}

// ─── Permission check ─────────────────────────────────────────
function isAdmin(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

function isEligible(member, cfg) {
  if (!member) return false;
  if (!cfg.allowed_role_id) return true; // no role set = everyone
  return member.roles.cache.has(cfg.allowed_role_id);
}

// ─── Interaction Handler ──────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member } = interaction;
  if (!guild) return;

  const cfg = storage.getConfig(guild.id);

  // ── batdau_diemdanh ──────────────────────────────────────────
  if (commandName === 'batdau_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền dùng lệnh này.', ephemeral: true });
    if (storage.getSession(guild.id)) return interaction.reply({ content: '❌ Đã có phiên điểm danh đang mở. Hãy kết thúc phiên cũ trước.', ephemeral: true });

    const tenPhien = interaction.options.getString('ten_phien');
    const thoiGian = interaction.options.getInteger('thoi_gian') ?? 0;

    // Lấy danh sách eligible members
    await guild.members.fetch().catch(() => null);
    const eligibleIds = cfg.allowed_role_id
      ? guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(cfg.allowed_role_id)).map(m => m.id)
      : guild.members.cache.filter(m => !m.user.bot).map(m => m.id);

    const now = new Date();
    const endTime = thoiGian > 0 ? new Date(now.getTime() + thoiGian * 60000) : null;
    const roleName = cfg.allowed_role_id ? (guild.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Unknown') : 'Tất cả';

    const session = storage.createSession(guild.id, {
      session_name: tenPhien,
      role_name: roleName,
      eligible_member_ids: eligibleIds,
      start_time: now.toLocaleString('vi-VN'),
      end_time: endTime ? endTime.toISOString() : null,
      attendees: {},
    });

    const embed = await embeds.buildDisplayEmbed(guild, session);
    await interaction.reply({ embeds: [embed] });

    if (thoiGian > 0) {
      await scheduleAutoClose(guild, session, interaction.channelId, thoiGian);
      await interaction.followUp({ content: `⏰ Phiên sẽ tự động kết thúc sau **${thoiGian} phút**.`, ephemeral: false });
    }
    return;
  }

  // ── ket_thuc_diemdanh ────────────────────────────────────────
  if (commandName === 'ket_thuc_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên điểm danh đang mở.', ephemeral: true });

    // Update member stats
    const checkedIds = new Set(Object.keys(session.attendees));
    for (const uid of session.eligible_member_ids) {
      const joined = session.attendees[uid]?.status === 'tham_gia';
      storage.updateMemberStats(guild.id, uid, joined);
    }

    storage.endSession(guild.id);
    clearTimers(guild.id);

    const embed = embeds.buildSummaryEmbed(session);
    await interaction.reply({ content: '🔒 Phiên điểm danh đã kết thúc!', embeds: [embed] });
    await announceNewBadges(guild, interaction.channel, session);
    return;
  }

  // ── huy_diemdanh ─────────────────────────────────────────────
  if (commandName === 'huy_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên nào đang mở.', ephemeral: true });
    storage.cancelSession(guild.id);
    clearTimers(guild.id);
    return interaction.reply({ content: `🗑️ Đã hủy phiên **${session.session_name}** (không lưu lịch sử).` });
  }

  // ── them_diemdanh ────────────────────────────────────────────
  if (commandName === 'them_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });

    const target = interaction.options.getMember('member');
    const status = interaction.options.getString('status');
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    storage.setAttendee(guild.id, target.id, { name: target.displayName, status, time });
    const embed = await embeds.buildDisplayEmbed(guild, storage.getSession(guild.id));
    return interaction.reply({ content: `✅ Đã thêm **${target.displayName}** — ${status === 'tham_gia' ? '✅ Tham gia' : '❌ Không tham gia'}`, embeds: [embed] });
  }

  // ── xoa_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xoa_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });

    const target = interaction.options.getMember('member');
    storage.removeAttendee(guild.id, target.id);
    return interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${target.displayName}**.` });
  }

  // ── sua_diemdanh ─────────────────────────────────────────────
  if (commandName === 'sua_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const changes = [];
    for (let i = 1; i <= 5; i++) {
      const m = interaction.options.getMember(`member${i}`);
      const s = interaction.options.getString(`status${i}`);
      if (m && s) {
        storage.setAttendee(guild.id, m.id, { name: m.displayName, status: s, time });
        changes.push(`**${m.displayName}** → ${s === 'tham_gia' ? '✅' : '❌'}`);
      }
    }
    return interaction.reply({ content: `✏️ Đã cập nhật:\n${changes.join('\n')}` });
  }

  // ── nhac_nho ─────────────────────────────────────────────────
  if (commandName === 'nhac_nho') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });

    const checkedIds = new Set(Object.keys(session.attendees));
    const absentIds = session.eligible_member_ids.filter(id => !checkedIds.has(id));
    if (absentIds.length === 0) return interaction.reply({ content: '✅ Tất cả thành viên đã điểm danh!', ephemeral: true });

    const mentions = absentIds.map(id => `<@${id}>`).join(' ');
    return interaction.reply({ content: `📣 **Chưa điểm danh (${absentIds.length} người):**\n${mentions}` });
  }

  // ── caidat_role ──────────────────────────────────────────────
  if (commandName === 'caidat_role') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const role = interaction.options.getRole('role');
    storage.setConfig(guild.id, { allowed_role_id: role.id, allowed_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role điểm danh: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_admin_role ────────────────────────────────────────
  if (commandName === 'caidat_admin_role') {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Chỉ Server Admin mới có thể cài admin role.', ephemeral: true });
    const role = interaction.options.getRole('role');
    storage.setConfig(guild.id, { admin_role_id: role.id, admin_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role admin bot: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_xem ───────────────────────────────────────────────
  if (commandName === 'caidat_xem') {
    const attendanceRole = cfg.allowed_role_id ? guild.roles.cache.get(cfg.allowed_role_id) : null;
    const adminRole = cfg.admin_role_id ? guild.roles.cache.get(cfg.admin_role_id) : null;
    const embed = embeds.buildConfigEmbed(cfg, attendanceRole, adminRole);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── xem_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xem_diemdanh') {
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên điểm danh đang mở.', ephemeral: true });
    const embed = await embeds.buildDisplayEmbed(guild, session);
    return interaction.reply({ embeds: [embed] });
  }

  // ── lich_su ──────────────────────────────────────────────────
  if (commandName === 'lich_su') {
    const history = storage.getHistory(guild.id);
    const embed = embeds.buildHistoryEmbed(history);
    return interaction.reply({ embeds: [embed] });
  }

  // ── thong_ke ─────────────────────────────────────────────────
  if (commandName === 'thong_ke') {
    await guild.members.fetch().catch(() => null);
    const allStats = storage.getAllMemberStats(guild.id);
    const sorted = Object.entries(allStats)
      .map(([uid, s]) => ({ uid, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const lines = sorted.map((s, i) => {
      const m = guild.members.cache.get(s.uid);
      const name = m ? m.displayName : `<@${s.uid}>`;
      const badge = getBadge(s.total);
      const pct = s.eligible > 0 ? Math.round((s.total / s.eligible) * 100) : 0;
      return `\`${String(i + 1).padStart(2)}.\` **${name}** — ${s.total} lần | ${pct}% ${badge ? `| ${badge}` : ''} | 🔥 ${s.streak}`;
    });

    const embed = embeds.buildStatsEmbed('🏆 Top 10 Thành Viên Tham Gia', lines);
    return interaction.reply({ embeds: [embed] });
  }

  // ── xuat_diemdanh ────────────────────────────────────────────
  if (commandName === 'xuat_diemdanh') {
    const session = storage.getSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });

    const attendees = Object.values(session.attendees);
    const joined = attendees.filter(x => x.status === 'tham_gia');
    const declined = attendees.filter(x => x.status === 'khong_tham_gia');

    let txt = `=== ĐIỂM DANH: ${session.session_name} ===\n`;
    txt += `Bắt đầu: ${session.start_time}\n\n`;
    txt += `✅ THAM GIA (${joined.length}):\n`;
    joined.forEach((x, i) => { txt += `${i + 1}. ${x.name} (${x.time})\n`; });
    txt += `\n❌ KHÔNG THAM GIA (${declined.length}):\n`;
    declined.forEach((x, i) => { txt += `${i + 1}. ${x.name}\n`; });

    const { AttachmentBuilder } = require('discord.js');
    const buf = Buffer.from(txt, 'utf-8');
    const file = new AttachmentBuilder(buf, { name: `diemdanh_${session.session_name.replace(/\s+/g, '_')}.txt` });
    return interaction.reply({ content: '📄 Xuất danh sách thành công!', files: [file] });
  }

  // ── xem_lich_su_member ────────────────────────────────────────
  if (commandName === 'xem_lich_su_member') {
    const target = interaction.options.getMember('member') ?? member;
    const stats = storage.getMemberStats(guild.id, target.id);
    const pct = stats.eligible > 0 ? Math.round((stats.total / stats.eligible) * 100) : 0;
    const badge = getBadge(stats.total);
    const bar = buildProgressBar(pct);
    const embed = new EmbedBuilder()
      .setTitle(`📋 Lịch Sử: ${target.displayName}`)
      .setColor(Colors.Blue)
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription([
        `📈 Tỷ lệ: \`${bar}\` **${pct}%** (${stats.total}/${stats.eligible})`,
        `🔥 Streak hiện tại: **${stats.streak}** phiên liên tiếp`,
        `🏅 Huy hiệu: ${badge || '(chưa có)'}`,
        `📌 Tổng tham gia: **${stats.total}** lần`,
      ].join('\n'))
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  // ── thong_ke_phien ────────────────────────────────────────────
  if (commandName === 'thong_ke_phien') {
    const soPhien = interaction.options.getInteger('so_phien');
    const history = storage.getHistory(guild.id);
    const s = history[history.length - soPhien];
    if (!s) return interaction.reply({ content: `❌ Không tìm thấy phiên số ${soPhien}.`, ephemeral: true });

    const eligible = s.eligible_count ?? (s.total_tham_gia + s.total_khong_tham_gia);
    const pct = eligible > 0 ? Math.round((s.total_tham_gia / eligible) * 100) : 0;
    const bar = buildProgressBar(pct);

    const joinedList = (s.attendees_joined ?? []).join('\n') || '—';
    const embed = new EmbedBuilder()
      .setTitle(`📊 Chi Tiết Phiên: ${s.session_name}`)
      .setColor(Colors.Green)
      .setDescription(`📈 \`${bar}\` **${pct}%** (${s.total_tham_gia}/${eligible})\n⏰ Bắt đầu: ${s.start_time}`)
      .addFields(
        { name: `✅ Tham Gia (${s.total_tham_gia})`, value: joinedList.slice(0, 1024), inline: false },
        { name: `❌ Không Tham Gia (${s.total_khong_tham_gia})`, value: String(s.total_khong_tham_gia), inline: false },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
});

// ─── Ready ────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Bot] Đã đăng nhập: ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
