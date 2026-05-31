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
const {
  buildAttendanceButtons,
  buildSessionEmbed,
  buildSummaryEmbed,
  buildMemberEmbed,
  buildStatsEmbed,
  buildHistoryEmbed,
  buildConfigEmbed,
  pctEmoji,
} = require('./utils/embeds.js');

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
    .addIntegerOption(o => o.setName('gio_ket_thuc').setDescription('Giờ kết thúc (0–23, giờ VN). Để trống = không tự đóng.').setRequired(false).setMinValue(0).setMaxValue(23))
    .addIntegerOption(o => o.setName('phut_ket_thuc').setDescription('Phút kết thúc (0–59). Mặc định = 0.').setRequired(false).setMinValue(0).setMaxValue(59))
    .addIntegerOption(o => o.setName('ngay_ket_thuc').setDescription('Ngày kết thúc (1–31). Để trống = hôm nay.').setRequired(false).setMinValue(1).setMaxValue(31)),
  new SlashCommandBuilder().setName('ket_thuc_diemdanh').setDescription('Kết thúc phiên điểm danh, lưu lịch sử'),
  new SlashCommandBuilder().setName('huy_diemdanh').setDescription('Hủy phiên điểm danh (không lưu lịch sử)'),
  new SlashCommandBuilder()
    .setName('them_diemdanh')
    .setDescription('Thêm thành viên điểm danh thủ công')
    .addUserOption(o => o.setName('member').setDescription('Thành viên cần thêm').setRequired(true))
    .addStringOption(o => o.setName('status').setDescription('Trạng thái').setRequired(true)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' })),
  new SlashCommandBuilder()
    .setName('xoa_diemdanh')
    .setDescription('Xóa điểm danh của một thành viên')
    .addUserOption(o => o.setName('member').setDescription('Thành viên cần xóa').setRequired(true)),
  new SlashCommandBuilder()
    .setName('sua_diemdanh')
    .setDescription('Sửa status điểm danh (tối đa 5 người)')
    .addUserOption(o => o.setName('member1').setDescription('Thành viên 1').setRequired(true))
    .addStringOption(o => o.setName('status1').setDescription('Status 1').setRequired(true)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member2').setDescription('Thành viên 2').setRequired(false))
    .addStringOption(o => o.setName('status2').setDescription('Status 2').setRequired(false)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member3').setDescription('Thành viên 3').setRequired(false))
    .addStringOption(o => o.setName('status3').setDescription('Status 3').setRequired(false)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member4').setDescription('Thành viên 4').setRequired(false))
    .addStringOption(o => o.setName('status4').setDescription('Status 4').setRequired(false)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' }))
    .addUserOption(o => o.setName('member5').setDescription('Thành viên 5').setRequired(false))
    .addStringOption(o => o.setName('status5').setDescription('Status 5').setRequired(false)
      .addChoices({ name: '✅ Tham Gia', value: 'tham_gia' }, { name: '❌ Vắng Mặt', value: 'khong_tham_gia' })),
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

// ─── Tính ms đến ngày/giờ/phút cố định (giờ VN UTC+7) ────────
function msUntilFixedDateTime(day, hour, minute) {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();
  const nowVnDate = new Date(nowUtcMs + VN_OFFSET_MS);
  const vnYear  = nowVnDate.getUTCFullYear();
  const vnMonth = nowVnDate.getUTCMonth();
  const vnDay   = nowVnDate.getUTCDate();
  const targetDay = day ?? vnDay;

  function buildTarget(year, month, d) {
    const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (d > maxDay) return null;
    const targetVnMs  = Date.UTC(year, month, d, hour, minute, 0, 0);
    const targetUtcMs = targetVnMs - VN_OFFSET_MS;
    return { ms: targetUtcMs - nowUtcMs, targetDate: new Date(targetUtcMs) };
  }

  let result = buildTarget(vnYear, vnMonth, targetDay);
  if (!result || result.ms <= 0) {
    const nextMonth = vnMonth === 11 ? 0 : vnMonth + 1;
    const nextYear  = vnMonth === 11 ? vnYear + 1 : vnYear;
    result = buildTarget(nextYear, nextMonth, targetDay);
  }
  if (!result || result.ms <= 0) {
    return { ms: -1, targetDate: null,
      errorMsg: `Ngày **${targetDay}** không tồn tại trong tháng hiện tại lẫn tháng sau. Hãy kiểm tra lại.` };
  }
  return { ...result, errorMsg: null };
}

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
        const s  = await db.getActiveSession(guild.id);
        if (!s || !ch) return;
        const attended  = await db.getAttendances(s.id);
        const checkedIds = new Set(attended.map(a => a.user_id));
        const absentIds  = s.eligible_member_ids.filter(id => !checkedIds.has(id));
        if (absentIds.length > 0) {
          await ch.send(`⏰ **Còn 2 phút!** Phiên **${s.session_name}** sắp đóng. Thành viên chưa điểm danh:\n${absentIds.map(id => `<@${id}>`).join(' ')}`);
        }
      } catch (e) { console.error('Reminder error:', e.message); }
    }, ms - 2 * 60 * 1000);
  }

  timers.closeTimer = setTimeout(async () => {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      const s  = await db.getActiveSession(guild.id);
      if (!s) return;
      const attended = await db.getAttendances(s.id);
      await finishSession(guild, s, attended);
      clearTimers(guild.id);
      if (ch) {
        try {
          const msgs = await ch.messages.fetch({ limit: 20 });
          const sessionMsg = msgs.find(m =>
            m.author.id === client.user.id &&
            m.components.length > 0 &&
            m.embeds[0]?.title?.includes(s.session_name)
          );
          if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] });
        } catch (_) {}
        const embed = buildSummaryEmbed(s, attended);
        await ch.send({ content: '🔒 **Phiên điểm danh đã tự động kết thúc!**', embeds: [embed] });
        await announceNewBadges(guild, ch, guild.id, s.id, attended);
      }
    } catch (e) { console.error('AutoClose error:', e.message); }
  }, ms);

  autoCloseTimers.set(guild.id, timers);
}

async function recoverTimers() {
  console.log('[Recover] Đang kiểm tra các phiên điểm danh còn dở...');
  let recovered = 0, expired = 0;
  for (const guild of client.guilds.cache.values()) {
    try {
      const session = await db.getActiveSession(guild.id);
      if (!session || !session.auto_close_at) continue;
      const closeAt = new Date(session.auto_close_at);
      const msLeft  = closeAt.getTime() - Date.now();
      if (msLeft > 0) {
        const channelId = session.channel_id ?? (await findNotifyChannel(guild));
        if (channelId) {
          await scheduleAutoClose(guild, session, channelId, msLeft);
          console.log(`[Recover] Guild ${guild.name}: phiên "${session.session_name}" còn ${formatDuration(msLeft)}, đã recover timer.`);
          recovered++;
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (ch) {
            const discordTs = Math.floor(closeAt.getTime() / 1000);
            await ch.send(`🔄 Bot vừa khởi động lại. Phiên điểm danh **${session.session_name}** vẫn đang mở — tự đóng lúc <t:${discordTs}:F> (còn ~${formatDuration(msLeft)}).`).catch(() => null);
          }
        }
      } else {
        console.log(`[Recover] Guild ${guild.name}: phiên "${session.session_name}" đã quá giờ, đóng ngay.`);
        await guild.members.fetch().catch(() => null);
        const attended = await db.getAttendances(session.id);
        await finishSession(guild, session, attended);
        expired++;
        const channelId = session.channel_id ?? (await findNotifyChannel(guild));
        if (channelId) {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (ch) {
            const embed = buildSummaryEmbed(session, attended);
            await ch.send({ content: `🔒 **Phiên "${session.session_name}" đã được đóng tự động** (bot restart — quá giờ).`, embeds: [embed] }).catch(() => null);
            await announceNewBadges(guild, ch, guild.id, session.id, attended).catch(() => null);
          }
        }
      }
    } catch (e) { console.error(`[Recover] Lỗi guild ${guild.name}:`, e.message); }
  }
  console.log(`[Recover] Hoàn tất: ${recovered} timer recovered, ${expired} phiên đóng muộn.`);
}

async function findNotifyChannel(guild) {
  if (guild.systemChannelId) {
    const ch = guild.channels.cache.get(guild.systemChannelId);
    if (ch && ch.permissionsFor(guild.members.me)?.has('SendMessages')) return guild.systemChannelId;
  }
  const textCh = guild.channels.cache.find(
    c => c.isTextBased() && !c.isThread() && c.permissionsFor(guild.members.me)?.has('SendMessages')
  );
  return textCh?.id ?? null;
}

// ─── Badges ───────────────────────────────────────────────────
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

function isAdmin(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.admin_role_id && member.roles.cache.has(cfg.admin_role_id)) return true;
  return false;
}

// ─── Helper: tìm session message gốc để edit buttons ─────────
async function findSessionMessage(channel, sessionName) {
  try {
    const msgs = await channel.messages.fetch({ limit: 30 });
    return msgs.find(m =>
      m.author.id === client.user.id &&
      m.components.length > 0 &&
      m.embeds[0]?.title?.includes(sessionName)
    ) ?? null;
  } catch (_) { return null; }
}

// ─── Interaction Handler ──────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  const { guild, member } = interaction;
  if (!guild) return;

  // ── BUTTON handler ───────────────────────────────────────────
  if (interaction.isButton()) {
    const { customId, user } = interaction;
    if (!['attend_yes', 'attend_no', 'attend_view'].includes(customId)) return;

    const session = await db.getActiveSession(guild.id);
    if (!session) {
      return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    }

    // Button xem danh sách (ephemeral)
    if (customId === 'attend_view') {
      await guild.members.fetch().catch(() => null);
      const attended = await db.getAttendances(session.id);
      const embed = await buildSessionEmbed(guild, session, attended);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Kiểm tra eligible
    if (!session.eligible_member_ids.includes(user.id)) {
      return interaction.reply({ content: '🚫 Bạn không có trong danh sách điểm danh của phiên này.', ephemeral: true });
    }

    const status = customId === 'attend_yes' ? 'tham_gia' : 'khong_tham_gia';
    const guildMember = await guild.members.fetch(user.id).catch(() => null);
    const displayName = guildMember?.displayName ?? user.username;

    await db.upsertAttendance(session.id, guild.id, user.id, displayName, status);

    // Cập nhật trạng thái cho người dùng
    const statusLabel = status === 'tham_gia' ? '✅ **Tham Gia**' : '❌ **Vắng Mặt**';

    // Update embed gốc
    try {
      await guild.members.fetch().catch(() => null);
      const attended = await db.getAttendances(session.id);
      const newEmbed = await buildSessionEmbed(guild, session, attended);
      await interaction.update({ embeds: [newEmbed], components: [buildAttendanceButtons()] });
    } catch (_) {
      await interaction.reply({ content: `✅ Đã cập nhật trạng thái của bạn thành ${statusLabel}.`, ephemeral: true });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;
  const cfg = await db.getConfig(guild.id);

  // ── batdau_diemdanh ──────────────────────────────────────────
  if (commandName === 'batdau_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const existing = await db.getActiveSession(guild.id);
    if (existing) return interaction.reply({ content: `⚠️ Đã có phiên **${existing.session_name}** đang mở. Kết thúc phiên cũ trước.`, ephemeral: true });

    const tenPhien    = interaction.options.getString('ten_phien');
    const gioKetThuc  = interaction.options.getInteger('gio_ket_thuc');
    const phutKetThuc = interaction.options.getInteger('phut_ket_thuc') ?? 0;
    const ngayKetThuc = interaction.options.getInteger('ngay_ket_thuc');

    let autoCloseMs = 0, autoCloseLabel = '', autoCloseAt = null;

    if (gioKetThuc !== null) {
      const pad = n => String(n).padStart(2, '0');
      const { ms, targetDate, errorMsg } = msUntilFixedDateTime(ngayKetThuc, gioKetThuc, phutKetThuc);
      if (errorMsg) return interaction.reply({ content: `❌ ${errorMsg}`, ephemeral: true });
      if (ms <= 0) {
        const dateStr = ngayKetThuc ? `ngày **${ngayKetThuc}** ` : '';
        return interaction.reply({ content: `❌ Thời gian kết thúc ${dateStr}**${pad(gioKetThuc)}:${pad(phutKetThuc)}** đã qua rồi.`, ephemeral: true });
      }
      autoCloseMs  = ms;
      autoCloseAt  = targetDate.toISOString();
      const discordTs = Math.floor(targetDate.getTime() / 1000);
      const dayPart   = ngayKetThuc ? `ngày ${ngayKetThuc}, ` : '';
      autoCloseLabel  = `${dayPart}**${pad(gioKetThuc)}:${pad(phutKetThuc)}** (<t:${discordTs}:F>) — còn ~${formatDuration(ms)}`;
    }

    await guild.members.fetch().catch(() => null);
    const eligibleIds = cfg.allowed_role_id
      ? guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(cfg.allowed_role_id)).map(m => m.id)
      : guild.members.cache.filter(m => !m.user.bot).map(m => m.id);
    const roleName = cfg.allowed_role_id ? (guild.roles.cache.get(cfg.allowed_role_id)?.name ?? 'Unknown') : 'Tất cả';

    const session = await db.createSession(guild.id, {
      sessionName: tenPhien, roleName,
      allowedRoleId: cfg.allowed_role_id,
      eligibleMemberIds: eligibleIds,
      startedBy: member.id,
      autoCloseAt,
      channelId: interaction.channelId,
    });

    const attended = [];
    const embed = await buildSessionEmbed(guild, session, attended);
    const row    = buildAttendanceButtons();

    await interaction.reply({ embeds: [embed], components: [row] });
    if (autoCloseMs > 0) await scheduleAutoClose(guild, session, interaction.channelId, autoCloseMs);
    return;
  }

  // ── ket_thuc_diemdanh ────────────────────────────────────────
  if (commandName === 'ket_thuc_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    await interaction.deferReply();
    const attended = await db.getAttendances(session.id);
    await finishSession(guild, session, attended);
    clearTimers(guild.id);
    const sessionMsg = await findSessionMessage(interaction.channel, session.session_name);
    if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
    const embed = buildSummaryEmbed(session, attended);
    await interaction.editReply({ content: `🔒 Phiên **${session.session_name}** đã kết thúc và lưu vào lịch sử.`, embeds: [embed] });
    await announceNewBadges(guild, interaction.channel, guild.id, session.id, attended);
    return;
  }

  // ── huy_diemdanh ─────────────────────────────────────────────
  if (commandName === 'huy_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    await db.cancelSession(session.id);
    clearTimers(guild.id);
    const sessionMsg = await findSessionMessage(interaction.channel, session.session_name);
    if (sessionMsg) await sessionMsg.edit({ components: [buildAttendanceButtons(true)] }).catch(() => null);
    return interaction.reply({ content: `🗑️ Đã hủy phiên **${session.session_name}**. Dữ liệu không được lưu.` });
  }

  // ── them_diemdanh ────────────────────────────────────────────
  if (commandName === 'them_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    const target = interaction.options.getMember('member');
    const status = interaction.options.getString('status');
    await db.upsertAttendance(session.id, guild.id, target.id, target.displayName, status);
    const label = status === 'tham_gia' ? '✅ Tham Gia' : '❌ Vắng Mặt';
    return interaction.reply({ content: `✅ Đã thêm **${target.displayName}** — ${label}`, ephemeral: true });
  }

  // ── xoa_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xoa_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    const target = interaction.options.getMember('member');
    await db.removeAttendance(session.id, target.id);
    return interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${target.displayName}**.`, ephemeral: true });
  }

  // ── sua_diemdanh ─────────────────────────────────────────────
  if (commandName === 'sua_diemdanh') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    const changes = [];
    for (let i = 1; i <= 5; i++) {
      const m = interaction.options.getMember(`member${i}`);
      const s = interaction.options.getString(`status${i}`);
      if (m && s) {
        await db.upsertAttendance(session.id, guild.id, m.id, m.displayName, s);
        changes.push(`**${m.displayName}** → ${s === 'tham_gia' ? '✅ Tham Gia' : '❌ Vắng Mặt'}`);
      }
    }
    return interaction.reply({ content: `✏️ Đã cập nhật:\n${changes.join('\n')}`, ephemeral: true });
  }

  // ── nhac_nho ─────────────────────────────────────────────────
  if (commandName === 'nhac_nho') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    const attended   = await db.getAttendances(session.id);
    const checkedIds = new Set(attended.map(a => a.user_id));
    const absentIds  = session.eligible_member_ids.filter(id => !checkedIds.has(id));
    if (absentIds.length === 0) return interaction.reply({ content: '✅ Tất cả đã điểm danh rồi!', ephemeral: true });
    return interaction.reply({ content: `📣 **Chưa điểm danh (${absentIds.length}):**\n${absentIds.map(id => `<@${id}>`).join(' ')}` });
  }

  // ── caidat_role ──────────────────────────────────────────────
  if (commandName === 'caidat_role') {
    if (!isAdmin(member, cfg)) return interaction.reply({ content: '🚫 Bạn không có quyền thực hiện lệnh này.', ephemeral: true });
    const role = interaction.options.getRole('role');
    await db.setConfig(guild.id, { allowed_role_id: role.id, allowed_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role điểm danh: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_admin_role ────────────────────────────────────────
  if (commandName === 'caidat_admin_role') {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '🚫 Chỉ Server Administrator mới có thể dùng lệnh này.', ephemeral: true });
    const role = interaction.options.getRole('role');
    await db.setConfig(guild.id, { admin_role_id: role.id, admin_role_name: role.name });
    return interaction.reply({ content: `✅ Đã cài role admin bot: **${role.name}**`, ephemeral: true });
  }

  // ── caidat_xem ───────────────────────────────────────────────
  if (commandName === 'caidat_xem') {
    const embed = buildConfigEmbed(cfg);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── xem_diemdanh ─────────────────────────────────────────────
  if (commandName === 'xem_diemdanh') {
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    await guild.members.fetch().catch(() => null);
    const attended = await db.getAttendances(session.id);
    const embed    = await buildSessionEmbed(guild, session, attended);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── lich_su ──────────────────────────────────────────────────
  if (commandName === 'lich_su') {
    await interaction.deferReply();
    const history = await db.getSessionHistory(guild.id, 20);
    const embed = buildHistoryEmbed(history);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── thong_ke ─────────────────────────────────────────────────
  if (commandName === 'thong_ke') {
    await interaction.deferReply();
    await guild.members.fetch().catch(() => null);
    const allStats = await db.getAllMemberStats(guild.id);
    const top10 = allStats.slice(0, 10);
    const lines = top10.map((s, i) => {
      const m    = guild.members.cache.get(s.user_id);
      const name = m ? m.displayName : `<@${s.user_id}>`;
      const pct  = s.total_sessions > 0 ? Math.round((s.total_joined / s.total_sessions) * 100) : 0;
      const bar  = buildProgressBar(pct, 8);
      const badge = getBadge(s.total_joined);
      return `\`${String(i + 1).padStart(2)}.\` **${name}**\n    \`${bar}\` ${pct}% · ${s.total_joined} lần · 🔥${s.current_streak}${badge ? ` · ${badge}` : ''}`;
    });
    const embed = buildStatsEmbed(lines);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── xuat_diemdanh ────────────────────────────────────────────
  if (commandName === 'xuat_diemdanh') {
    const session = await db.getActiveSession(guild.id);
    if (!session) return interaction.reply({ content: '📭 Hiện không có phiên điểm danh nào đang mở.', ephemeral: true });
    await interaction.deferReply();
    const attended = await db.getAttendances(session.id);
    const joined   = attended.filter(a => a.status === 'tham_gia');
    const declined = attended.filter(a => a.status === 'khong_tham_gia');
    let txt = `=== ĐIỂM DANH: ${session.session_name} ===\n`;
    txt += `Bắt đầu: ${new Date(session.started_at).toLocaleString('vi-VN')}\n\n`;
    txt += `✅ THAM GIA (${joined.length}):\n`;
    joined.forEach((a, i)   => { txt += `${i + 1}. ${a.username}\n`; });
    txt += `\n❌ VẮNG MẶT (${declined.length}):\n`;
    declined.forEach((a, i) => { txt += `${i + 1}. ${a.username}\n`; });
    const file = new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `diemdanh_${session.session_name.replace(/\s+/g, '_')}.txt` });
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
    const embed = buildMemberEmbed(target, stats, badge, pct, bar);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── thong_ke_phien ────────────────────────────────────────────
  if (commandName === 'thong_ke_phien') {
    const soPhien = interaction.options.getInteger('so_phien');
    await interaction.deferReply();
    const history = await db.getSessionHistory(guild.id, soPhien + 5);
    const s = history[soPhien - 1];
    if (!s) return interaction.editReply({ content: `❌ Không tìm thấy phiên số **${soPhien}**. Dùng /lich_su để xem danh sách.` });
    const attended = await db.getAttendances(s.id);
    const embed = buildSummaryEmbed(s, attended);
    embed.setTitle(`🔍 Chi Tiết Phiên #${soPhien}: ${s.session_name}`);
    return interaction.editReply({ embeds: [embed] });
  }
});

// ─── Ready ────────────────────────────────────────────────────
client.once('clientReady', async () => {
  console.log(`[Bot] Đã đăng nhập: ${client.user.tag}`);
  await registerCommands();
  await recoverTimers();
});

client.login(process.env.DISCORD_TOKEN);
