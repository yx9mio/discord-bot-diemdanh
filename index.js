// ============================================================
// Bot Điểm Danh Discord — Supabase Edition
// Node.js + discord.js v14 + @supabase/supabase-js
// ============================================================
require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, Colors, PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');

const db = require('./db.js');
const { buildProgressBar } = require('./utils/progress.js');
const embeds = require('./utils/embeds.js');

// ─── Validate env ─────────────────────────────────────────────
for (const key of ['DISCORD_TOKEN', 'CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_KEY']) {
  if (!process.env[key]) {
    console.error(`[FATAL] Thiếu ${key} trong .env!`);
    process.exit(1);
  }
}

// ─── Client ───────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.GuildMember],
});

// ─── Slash Commands ────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('batdau_diemdanh')
    .setDescription('Mở phiên điểm danh mới')
    .addStringOption(o => o.setName('ten_phien').setDescription('Tên phiên (vd: Bang Chiến T7)').setRequired(true))
    .addIntegerOption(o => o
      .setName('gio_dong')
      .setDescription('Giờ tự động đóng (0-23, theo giờ VN UTC+7). Để trống = không tự đóng.')
      .setRequired(false)
      .setMinValue(0).setMaxValue(23))
    .addIntegerOption(o => o
      .setName('phut_dong')
      .setDescription('Phút tự động đóng (0-59). Mặc định = 0 nếu đã nhập gio_dong.')
      .setRequired(false)
      .setMinValue(0).setMaxValue(59)),
  new SlashCommandBuilder().setName('ket_thuc_diemdanh').setDescription('Kết thúc phiên điểm danh, lưu lịch sử'),
  new SlashCommandBuilder().setName('huy_diemdanh').setDescription('Hủy phiên điểm danh (không lưu lịch sử)'),
  new SlashCommandBuilder()
    .setName('them_diemdanh')
    .setDescription('Thêm thành viên điểm danh thủ công')
    .addUserOption(o => o.setName('member').setDescription('Thành viên cần thêm').setRequired(true))
    .addStringOption(o => o.setName('status').setDescription('Trạng thái').setRequired(true)
      .addChoices({ name: '✅ Tham gia', value: 'tham_gia' }, { name: '❌ Không tham gia', value: 'khong_tham_gia' })),
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
  new SlashCommandBuilder().setName('nhac_nho').setDescription('Ping người chưa điểm danh'),
  new SlashCommandBuilder()
    .setName('caidat_role')
    .setDescription('Cài role được phép điểm danh')
    .addRoleOption(o => o.setName('role').setDescription('Role điểm danh').setRequired(true)),
  new SlashCommandBuilder()
    .setName('caidat_admin_role')
    .setDescription('Cài role admin bot')
    .addRoleOption(o => o.setName('role').setDescription('Role admin bot').setRequired(true)),
  new SlashCommandBuilder().setName('caidat_xem').setDescription('Xem cấu hình hiện tại của bot'),
  new SlashCommandBuilder().setName('xem_diemdanh').setDescription('Xem danh sách điểm danh phiên hiện tại'),
  new SlashCommandBuilder().setName('lich_su').setDescription('Xem lịch sử các phiên điểm danh đã kết thúc'),
  new SlashCommandBuilder().setName('thong_ke').setDescription('Top 10 thành viên tham gia nhiều nhất'),
  new SlashCommandBuilder().setName('xuat_diemdanh').setDescription('Xuất danh sách điểm danh ra file .txt'),
  new SlashCommandBuilder()
    .setName('xem_lich_su_member')
    .setDescription('Lịch sử cá nhân: tỷ lệ %, streak, huy hiệu')
    .addUserOption(o => o.setName('member').setDescription('Thành viên (để trống = bản thân)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('thong_ke_phien')
    .setDescription('Chi tiết 1 phiên cụ thể từ lịch sử')
    .addIntegerOption(o => o.setName('so_phien').setDescription('Số thứ tự phiên (1 = mới nhất)').setRequired(true).setMinValue(1)),
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('[Commands] Đang đăng ký slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('[Commands] Đăng ký thành công!');
  } catch (e) {
    console.error('[Commands] Lỗi đăng ký:', e.message);
  }
}

// ─── Tính số ms đến giờ:phút cố định hôm nay (UTC+7) ─────────
// Trả về { ms, targetDate }
// ms < 0 nếu giờ đó đã qua hôm nay
function msUntilFixedTime(hour, minute) {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();

  // Tính "hôm nay theo giờ VN": lấy ngày năm tháng VN
  const nowVnMs = nowUtcMs + VN_OFFSET_MS;
  const nowVnDate = new Date(nowVnMs);

  // Xây target theo giờ VN: năm/tháng/ngày giờ VN + hour:minute:00
  const targetVnMs = Date.UTC(
    nowVnDate.getUTCFullYear(),
    nowVnDate.getUTCMonth(),
    nowVnDate.getUTCDate(),
    hour,    // giờ VN (offset đã là 0 vì ta đang làm việc trong "không gian VN")
    minute,
    0, 0
  );
  // targetVnMs là miliseconds nếu đây là UTC, nhưng thực ra là giờ VN —
  // phải trừ đi VN_OFFSET để ra UTC thật sự
  const targetUtcMs = targetVnMs - VN_OFFSET_MS;

  return {
    ms: targetUtcMs - nowUtcMs,
    targetDate: new Date(targetUtcMs),
  };
}

// ─── Format thời lượng ms → chuỗi "X giờ Y phút" hoặc "Y phút" ─
function formatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} phút`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}

// ─── Auto-close timers (in-memory) ────────────────────────────
const autoCloseTimers = new Map();

function clearTimers(guildId) {
  const t = autoCloseTimers.get(guildId);
  if (!t) return;
  clearTimeout(t.closeTimer);
  clearTimeout(t.reminderTimer);
  autoCloseTimers.delete(guildId);
}

async function scheduleAutoClose(guild, session, channelId, ms) {
  clearTimers(guild.id);
  const timers = {};

  if (ms > 2 * 60 * 1000) {
    timers.reminderTimer = setTimeout(async () => {
      try {
        const ch = await guild.channels.fetch(channelId).catch(() => null);
        const s = await db.getActiveSession(guild.id);
        if (!s || !ch) return;
        const attended = await db.getAttendances(s.id);
        const checkedIds = new Set(attended.map(a => a.user_id));
        const absentIds = s.eligible_member_ids.filter(id => !checkedIds.has(id));
        if (absentIds.length > 0) {
          await ch.send(`⏰ **Nhắc nhở:** Phiên **${s.session_name}** đóng sau 2 phút!\n${absentIds.map(id => `<@${id}>`).join(' ')}`);
        }
      } catch (e) { console.error('Reminder error:', e.message); }
    }, ms - 2 * 60 * 1000);
  }

  timers.closeTimer = setTimeout(async () => {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      const s = await db.getActiveSession(guild.id);
      if (!s) return;
      const attended = await db.getAttendances(s.id);
      await finishSession(guild, s, attended);
      clearTimers(guild.id);
      if (ch) {
        const embed = buildSummaryEmbed(s, attended);
        await ch.send({ content: '🔒 **Phiên điểm danh đã tự động kết thúc!**', embeds: [embed] });
        await announceNewBadges(guild, ch, guild.id, s.id, attended);
      }
    } catch (e) { console.error('AutoClose error:', e.message); }
  }, ms);

  autoCloseTimers.set(guild.id, timers);
}

// ─── Helpers ──────────────────────────────────────────────────
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
  for (const m of BADGE_MILESTONES) if (count >= m.count) badge = `${m.badge} ${m.label}`;
  return badge;
}

async function finishSession(guild, session, attended) {
  for (const uid of session.eligible_member_ids) {
    const joined = attended.some(a => a.user_id === uid && a.status === 'tham_gia');
    await db.updateMemberStats(guild.id, uid, joined, session.id);
  }
  await db.endSession(session.id);
}

async function announceNewBadges(guild, channel, guildId, sessionId, attended) {
  const msgs = [];
  for (const a of attended) {
    if (a.status !== 'tham_gia') continue;
    const stats = await db.getMemberStats(guildId, a.user_id);
    const prevJoined = stats.total_joined - 1;
    for (const m of BADGE_MILESTONES) {
      if (prevJoined < m.count && stats.total_joined >= m.count) {
        msgs.push(`🎉 <@${a.user_id}> đạt huy hiệu **${m.badge} ${m.label}** (${m.count} lần tham gia)!`);
      }
    }
  }
  if (msgs.length > 0) await channel.send(msgs.join('\n')).catch(() => null);
}

function buildSummaryEmbed(session, attended) {
  const joined = attended.filter(a => a.status === 'tham_gia');
  const declined = attended.filter(a => a.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
  const bar = buildProgressBar(pct);
  return new EmbedBuilder()
    .setTitle(`📋 Kết Quả: ${session.session_name}`)
    .setColor(Colors.Green)
    .setDescription(`\`${bar}\` **${pct}%** (${joined.length}/${eligible})\n⏰ Bắt đầu: <t:${Math.floor(new Date(session.started_at).getTime()/1000)}:f>`)
    .addFields(
      { name: `✅ Tham Gia (${joined.length})`,        value: joined.map(a => a.username).join('\n') || '—', inline: true },
      { name: `❌ Không Tham Gia (${declined.length})`, value: declined.map(a => a.username).join('\n') || '—', inline: true },
    )
    .setTimestamp();
}

function isAdmin(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

// ─── Interaction Handler ──────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guild, member } = interaction;
  if (!guild) return;

  const cfg = await db.getConfig(guild.id);

  // ── batdau_diemdanh ──────────────────────────────────────────
  if (commandName === 'batdau_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền dùng lệnh này.', ephemeral: true });
    const existing = await db.getActiveSession(guild.id);
    if (existing) return interaction.reply({ content: '❌ Đã có phiên điểm danh đang mở. Hãy kết thúc phiên cũ trước.', ephemeral: true });

    const tenPhien = interaction.options.getString('ten_phien');
    const gioDong  = interaction.options.getInteger('gio_dong');
    const phutDong = interaction.options.getInteger('phut_dong') ?? 0;

    // Tính ms đến giờ đóng cố định (UTC+7)
    let autoCloseMs = 0;
    let autoCloseLabel = '';
    let autoCloseAt = null;

    if (gioDong !== null) {
      const { ms, targetDate } = msUntilFixedTime(gioDong, phutDong);
      const pad = n => String(n).padStart(2, '0');

      if (ms <= 0) {
        return interaction.reply({
          content: `❌ Giờ đóng **${pad(gioDong)}:${pad(phutDong)}** đã qua rồi hôm nay. Hãy chọn giờ trong tương lai (giờ VN).`,
          ephemeral: true,
        });
      }

      autoCloseMs = ms;
      autoCloseAt = targetDate.toISOString();

      // Discord timestamp: hiển thị giờ:phút local của người dùng
      const discordTs = Math.floor(targetDate.getTime() / 1000);
      autoCloseLabel = `**${pad(gioDong)}:${pad(phutDong)}** (<t:${discordTs}:t>) — còn ~${formatDuration(ms)}`;
    }

    await guild.members.fetch().catch(() => null);
    const eligibleIds = cfg.allowed_role_id
      ? guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(cfg.allowed_role_id)).map(m => m.id)
      : guild.members.cache.filter(m => !m.user.bot).map(m => m.id);

    const roleName = cfg.allowed_role_id ? (guild.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Unknown') : 'Tất cả';

    const session = await db.createSession(guild.id, {
      sessionName: tenPhien,
      roleName,
      allowedRoleId: cfg.allowed_role_id,
      eligibleMemberIds: eligibleIds,
      startedBy: member.id,
      autoCloseAt,
    });

    const embed = new EmbedBuilder()
      .setTitle(`📋 Điểm Danh: ${tenPhien}`)
      .setColor(Colors.Blue)
      .setDescription(
        `👥 Role: **${roleName}** | Thành viên: **${eligibleIds.length}**\n` +
        `⏰ Bắt đầu: <t:${Math.floor(Date.now()/1000)}:f>` +
        (autoCloseMs > 0 ? `\n🔒 Tự đóng lúc: ${autoCloseLabel}` : '')
      )
      .setFooter({ text: 'Dùng /them_diemdanh để thêm thành viên' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    if (autoCloseMs > 0) await scheduleAutoClose(guild, session, interaction.channelId, autoCloseMs);
    return;
  }

  // ── ket_thuc_diemdanh ────────────────────────────────────────
  if (commandName === 'ket_thuc_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên điểm danh đang mở.', ephemeral: true });
    await interaction.deferReply();
    const attended = await db.getAttendances(session.id);
    await finishSession(guild, session, attended);
    clearTimers(guild.id);
    const embed = buildSummaryEmbed(session, attended);
    await interaction.editReply({ content: '🔒 Phiên điểm danh đã kết thúc!', embeds: [embed] });
    await announceNewBadges(guild, interaction.channel, guild.id, session.id, attended);
    return;
  }

  // ── huy_diemdanh ─────────────────────────────────────────────
  if (commandName === 'huy_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên nào đang mở.', ephemeral: true });
    await db.cancelSession(session.id);
    clearTimers(guild.id);
    return interaction.reply({ content: `🗑️ Đã hủy phiên **${session.session_name}** (không lưu lịch sử).` });
  }

  // ── them_diemdanh ────────────────────────────────────────────
  if (commandName === 'them_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });
    const target = interaction.options.getMember('member');
    const status = interaction.options.getString('status');
    await db.upsertAttendance(session.id, guild.id, target.id, target.displayName, status);
    const label = status === 'tham_gia' ? '✅ Tham gia' : '❌ Không tham gia';
    return interaction.reply({ content: `✅ Đã thêm **${target.displayName}** — ${label}` });
  }

  // ── xoa_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xoa_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });
    const target = interaction.options.getMember('member');
    await db.removeAttendance(session.id, target.id);
    return interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${target.displayName}**.` });
  }

  // ── sua_diemdanh ─────────────────────────────────────────────
  if (commandName === 'sua_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });
    const changes = [];
    for (let i = 1; i <= 5; i++) {
      const m = interaction.options.getMember(`member${i}`);
      const s = interaction.options.getString(`status${i}`);
      if (m && s) {
        await db.upsertAttendance(session.id, guild.id, m.id, m.displayName, s);
        changes.push(`**${m.displayName}** → ${s === 'tham_gia' ? '✅' : '❌'}`);
      }
    }
    return interaction.reply({ content: `✏️ Đã cập nhật:\n${changes.join('\n')}` });
  }

  // ── nhac_nho ─────────────────────────────────────────────────
  if (commandName === 'nhac_nho') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });
    const attended = await db.getAttendances(session.id);
    const checkedIds = new Set(attended.map(a => a.user_id));
    const absentIds = session.eligible_member_ids.filter(id => !checkedIds.has(id));
    if (absentIds.length === 0) return interaction.reply({ content: '✅ Tất cả đã điểm danh!', ephemeral: true });
    return interaction.reply({ content: `📣 **Chưa điểm danh (${absentIds.length}):**\n${absentIds.map(id => `<@${id}>`).join(' ')}` });
  }

  // ── caidat_role ──────────────────────────────────────────────
  if (commandName === 'caidat_role') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '❌ Bạn không có quyền.', ephemeral: true });
    const role = interaction.options.getRole('role');
    await db.setConfig(guild.id, { allowed_role_id: role.id, allowed_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role điểm danh: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_admin_role ────────────────────────────────────────
  if (commandName === 'caidat_admin_role') {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Chỉ Server Admin.', ephemeral: true });
    const role = interaction.options.getRole('role');
    await db.setConfig(guild.id, { admin_role_id: role.id, admin_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role admin bot: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_xem ───────────────────────────────────────────────
  if (commandName === 'caidat_xem') {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Cấu Hình Bot')
      .setColor(Colors.Grey)
      .addFields(
        { name: 'Role Điểm Danh', value: cfg.allowed_role_id ? `<@&${cfg.allowed_role_id}>` : 'Tất cả thành viên', inline: true },
        { name: 'Role Admin Bot',  value: cfg.admin_role_id   ? `<@&${cfg.admin_role_id}>`   : 'Server Admin',       inline: true },
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── xem_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xem_diemdanh') {
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên điểm danh đang mở.', ephemeral: true });
    await interaction.deferReply();
    const attended = await db.getAttendances(session.id);
    const joined   = attended.filter(a => a.status === 'tham_gia');
    const declined = attended.filter(a => a.status === 'khong_tham_gia');
    const eligible = session.eligible_member_ids.length;
    const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
    const bar = buildProgressBar(pct);
    const autoInfo = session.auto_close_at
      ? `\n🔒 Tự đóng lúc: <t:${Math.floor(new Date(session.auto_close_at).getTime()/1000)}:t>`
      : '';
    const embed = new EmbedBuilder()
      .setTitle(`📋 Điểm Danh: ${session.session_name}`)
      .setColor(Colors.Blue)
      .setDescription(`\`${bar}\` **${pct}%** (${joined.length}/${eligible})${autoInfo}`)
      .addFields(
        { name: `✅ Tham Gia (${joined.length})`,        value: joined.map(a => a.username).join('\n') || '—', inline: true },
        { name: `❌ Không Tham Gia (${declined.length})`, value: declined.map(a => a.username).join('\n') || '—', inline: true },
      )
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── lich_su ──────────────────────────────────────────────────
  if (commandName === 'lich_su') {
    await interaction.deferReply();
    const history = await db.getSessionHistory(guild.id, 20);
    if (history.length === 0) return interaction.editReply({ content: '📭 Chưa có phiên nào kết thúc.' });
    const lines = history.map((s, i) =>
      `\`${i + 1}.\` **${s.session_name}** — <t:${Math.floor(new Date(s.started_at).getTime()/1000)}:d>`
    );
    const embed = new EmbedBuilder()
      .setTitle('📚 Lịch Sử Điểm Danh')
      .setColor(Colors.Purple)
      .setDescription(lines.join('\n'))
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── thong_ke ─────────────────────────────────────────────────
  if (commandName === 'thong_ke') {
    await interaction.deferReply();
    await guild.members.fetch().catch(() => null);
    const allStats = await db.getAllMemberStats(guild.id);
    const top10 = allStats.slice(0, 10);
    const lines = top10.map((s, i) => {
      const m = guild.members.cache.get(s.user_id);
      const name = m ? m.displayName : `<@${s.user_id}>`;
      const pct = s.total_sessions > 0 ? Math.round((s.total_joined / s.total_sessions) * 100) : 0;
      const badge = getBadge(s.total_joined);
      return `\`${String(i+1).padStart(2)}.\` **${name}** — ${s.total_joined} lần | ${pct}% ${badge ? `| ${badge}` : ''} | 🔥 ${s.current_streak}`;
    });
    const embed = new EmbedBuilder()
      .setTitle('🏆 Top 10 Thành Viên')
      .setColor(Colors.Gold)
      .setDescription(lines.join('\n') || 'Chưa có dữ liệu.')
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── xuat_diemdanh ────────────────────────────────────────────
  if (commandName === 'xuat_diemdanh') {
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '❌ Không có phiên đang mở.', ephemeral: true });
    await interaction.deferReply();
    const attended = await db.getAttendances(session.id);
    const joined   = attended.filter(a => a.status === 'tham_gia');
    const declined = attended.filter(a => a.status === 'khong_tham_gia');
    let txt = `=== ĐIỂM DANH: ${session.session_name} ===\n`;
    txt += `Bắt đầu: ${new Date(session.started_at).toLocaleString('vi-VN')}\n\n`;
    txt += `✅ THAM GIA (${joined.length}):\n`;
    joined.forEach((a, i)   => { txt += `${i+1}. ${a.username}\n`; });
    txt += `\n❌ KHÔNG THAM GIA (${declined.length}):\n`;
    declined.forEach((a, i) => { txt += `${i+1}. ${a.username}\n`; });
    const file = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `diemdanh_${session.session_name.replace(/\s+/g,'_')}.txt` });
    return interaction.editReply({ content: '📄 Xuất thành công!', files: [file] });
  }

  // ── xem_lich_su_member ────────────────────────────────────────
  if (commandName === 'xem_lich_su_member') {
    const target = interaction.options.getMember('member') ?? member;
    await interaction.deferReply();
    const stats = await db.getMemberStats(guild.id, target.id);
    const pct   = stats.total_sessions > 0 ? Math.round((stats.total_joined / stats.total_sessions) * 100) : 0;
    const badge = getBadge(stats.total_joined);
    const bar   = buildProgressBar(pct);
    const embed = new EmbedBuilder()
      .setTitle(`📋 Lịch Sử: ${target.displayName}`)
      .setColor(Colors.Blue)
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription([
        `📈 Tỷ lệ: \`${bar}\` **${pct}%** (${stats.total_joined}/${stats.total_sessions})`,
        `🔥 Streak: **${stats.current_streak}** phiên | Best: **${stats.best_streak}**`,
        `🏅 Huy hiệu: ${badge || '(chưa có)'}`,
      ].join('\n'))
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── thong_ke_phien ────────────────────────────────────────────
  if (commandName === 'thong_ke_phien') {
    const soPhien = interaction.options.getInteger('so_phien');
    await interaction.deferReply();
    const history = await db.getSessionHistory(guild.id, soPhien + 5);
    const s = history[soPhien - 1];
    if (!s) return interaction.editReply({ content: `❌ Không tìm thấy phiên số ${soPhien}.` });
    const attended = await db.getAttendances(s.id);
    const joined   = attended.filter(a => a.status === 'tham_gia');
    const eligible = s.eligible_member_ids.length;
    const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;
    const bar = buildProgressBar(pct);
    const embed = new EmbedBuilder()
      .setTitle(`📊 Chi Tiết: ${s.session_name}`)
      .setColor(Colors.Green)
      .setDescription(`\`${bar}\` **${pct}%** (${joined.length}/${eligible})\n⏰ Bắt đầu: <t:${Math.floor(new Date(s.started_at).getTime()/1000)}:f>`)
      .addFields(
        { name: `✅ Tham Gia (${joined.length})`, value: joined.map(a => a.username).join('\n') || '—', inline: false },
      )
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }
});

// ─── Ready ────────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log(`[Bot] Đã đăng nhập: ${client.user.tag}`);
  await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
