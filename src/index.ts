import 'dotenv/config';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  Guild,
  GuildMember,
  Interaction,
  OverwriteType,
  PermissionFlagsBits,
  REST,
  Role,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { ConfigStore, HistoryStore, MemberStatsStore, SessionStore } from './storage.js';
import { AttendanceStatus, HistorySession, MemberStats, Session } from './types.js';
import {
  buildConfigEmbed,
  buildDisplayEmbed,
  buildHistoryEmbed,
  buildStatsEmbed,
  buildSummaryEmbed,
} from './utils/embeds.js';
import { MILESTONE_EMOJI, updateMemberStats } from './streak.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('❌ Thiếu DISCORD_TOKEN trong .env');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const timers = new Map<string, { reminder?: NodeJS.Timeout; autoClose?: NodeJS.Timeout }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowTime(): string {
  return new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function nowDatetime(): string {
  return new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function toIsoAfterMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function attendanceButtons(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_tham_gia')
      .setLabel('✅ Tham Gia')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('btn_khong_tham_gia')
      .setLabel('❌ Không Tham Gia')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

// ─── Admin Role Guard ─────────────────────────────────────────────────────────

async function isAdminUser(interaction: ChatInputCommandInteraction<'cached'>): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  const cfg = ConfigStore.get(interaction.guild.id);
  if (cfg.admin_role_id) {
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (member?.roles.cache.has(cfg.admin_role_id)) return true;
  }
  const roleByName = interaction.guild.roles.cache.find(
    (r) => r.name === (cfg.admin_role_name || 'Bang Chủ'),
  );
  if (roleByName) {
    ConfigStore.set(interaction.guild.id, { ...cfg, admin_role_id: roleByName.id });
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (member?.roles.cache.has(roleByName.id)) return true;
  }
  return false;
}

async function assertAdmin(interaction: ChatInputCommandInteraction<'cached'>): Promise<boolean> {
  const ok = await isAdminUser(interaction);
  if (!ok) {
    const cfg = ConfigStore.get(interaction.guild.id);
    await interaction.reply({
      content: `🚫 Bạn không có quyền dùng lệnh này.\nYêu cầu role **${cfg.admin_role_name}** hoặc quyền **Quản lý Server**.`,
      ephemeral: true,
    });
  }
  return ok;
}

// ─── Attendance Role ──────────────────────────────────────────────────────────

async function resolveAllowedRole(guild: Guild): Promise<Role | null> {
  const cfg = ConfigStore.get(guild.id);
  if (cfg.allowed_role_id) {
    const byId = await guild.roles.fetch(cfg.allowed_role_id).catch(() => null);
    if (byId) return byId;
  }
  const byName = guild.roles.cache.find(
    (r) => r.name === (cfg.allowed_role_name || 'Bang Chúng'),
  ) ?? null;
  if (byName) {
    ConfigStore.set(guild.id, { ...cfg, allowed_role_id: byName.id });
    return byName;
  }
  return null;
}

async function resolveAdminRole(guild: Guild): Promise<Role | null> {
  const cfg = ConfigStore.get(guild.id);
  if (cfg.admin_role_id) {
    const byId = await guild.roles.fetch(cfg.admin_role_id).catch(() => null);
    if (byId) return byId;
  }
  return guild.roles.cache.find(
    (r) => r.name === (cfg.admin_role_name || 'Bang Chủ'),
  ) ?? null;
}

// ─── Display Channel ──────────────────────────────────────────────────────────

async function getOrCreateDisplayChannel(guild: Guild): Promise<TextChannel> {
  const existing = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.name === 'diemdanh-bang-chien',
  );
  if (existing) return existing as TextChannel;
  return guild.channels.create({
    name: 'diemdanh-bang-chien',
    type: ChannelType.GuildText,
    topic: '📋 Danh sách điểm danh Bang Chiến — Tự động cập nhật',
    reason: 'Bot tạo channel hiển thị điểm danh',
    permissionOverwrites: [
      { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: ['SendMessages', 'AddReactions'] },
      { id: client.user!.id, type: OverwriteType.Member, allow: ['SendMessages', 'ManageMessages'] },
    ],
  });
}

async function updateDisplay(guild: Guild): Promise<void> {
  const session = SessionStore.get(guild.id);
  if (!session || !session.display_message_id) return;
  try {
    const channel = await guild.channels.fetch(session.display_channel_id) as TextChannel;
    const msg = await channel.messages.fetch(session.display_message_id);
    await msg.edit({ embeds: [await buildDisplayEmbed(guild, session)], components: [attendanceButtons(false)] });
  } catch { /* noop */ }
}

// ─── Session Timers ───────────────────────────────────────────────────────────

function clearGuildTimers(guildId: string): void {
  const t = timers.get(guildId);
  if (t?.reminder) clearTimeout(t.reminder);
  if (t?.autoClose) clearTimeout(t.autoClose);
  timers.delete(guildId);
}

async function finishSession(guild: Guild, reason = 'manual'): Promise<void> {
  const session = SessionStore.get(guild.id);
  if (!session) return;
  session.ended = true;

  try {
    const displayChannel = await guild.channels.fetch(session.display_channel_id) as TextChannel;
    if (session.display_message_id) {
      const msg = await displayChannel.messages.fetch(session.display_message_id);
      await msg.edit({
        embeds: [await buildDisplayEmbed(guild, session, true)],
        components: [attendanceButtons(true)],
      });
    }
  } catch { /* noop */ }

  const endTime = nowDatetime();
  const attendees = Object.values(session.attendees);

  const history: HistorySession = {
    session_name: session.session_name,
    start_time: session.start_time,
    end_time: endTime,
    role_name: session.role_name,
    attendees: session.attendees,
    total_tham_gia: attendees.filter((x) => x.status === 'tham_gia').length,
    total_khong_tham_gia: attendees.filter((x) => x.status === 'khong_tham_gia').length,
    eligible_count: session.eligible_member_ids.length,
  };
  HistoryStore.push(guild.id, history);

  // ── Update member stats & collect badge announcements ──
  const allHistory = HistoryStore.get(guild.id); // includes the one just pushed
  const milestoneAnnouncements: { userId: string; name: string; milestones: number[] }[] = [];
  const statsUpdates: Record<string, MemberStats> = {};

  // Process all eligible members (both attended and absent)
  const eligibleSet = new Set(session.eligible_member_ids);
  for (const userId of eligibleSet) {
    const record = session.attendees[userId];
    const member = guild.members.cache.get(userId);
    const name = member?.displayName ?? record?.name ?? userId;
    const existing = MemberStatsStore.get(guild.id, userId);
    const { stats, newMilestones } = updateMemberStats(existing, userId, name, record, endTime, allHistory);
    statsUpdates[userId] = stats;
    if (newMilestones.length > 0) milestoneAnnouncements.push({ userId, name, milestones: newMilestones });
  }
  MemberStatsStore.setMany(guild.id, statsUpdates);

  try {
    const announceChannel = await guild.channels.fetch(session.announce_channel_id) as TextChannel;
    await announceChannel.send({
      embeds: [
        buildSummaryEmbed(session).setFooter({
          text: reason === 'auto' ? 'Phiên tự động kết thúc' : 'Phiên kết thúc thủ công',
        }),
      ],
    });

    // Badge announcements
    for (const { userId, name, milestones } of milestoneAnnouncements) {
      const lines = milestones.map(
        (m) => `${MILESTONE_EMOJI[m] ?? '🎖️'} **${name}** đạt mốc **${m} lần tham gia**! <@${userId}>`,
      );
      await announceChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏅 Thành Tích Mới!')
            .setColor(Colors.Gold)
            .setDescription(lines.join('\n'))
            .setTimestamp(),
        ],
        allowedMentions: { users: [userId] },
      });
    }
  } catch { /* noop */ }

  SessionStore.delete(guild.id);
  clearGuildTimers(guild.id);
}

function scheduleSession(guildId: string): void {
  clearGuildTimers(guildId);
  const session = SessionStore.get(guildId);
  if (!session || !session.end_time) return;

  const endMs = new Date(session.end_time).getTime() - Date.now();
  const reminderMs =
    session.reminder_minutes_before_end !== null
      ? endMs - session.reminder_minutes_before_end * 60_000
      : null;
  const bucket: { reminder?: NodeJS.Timeout; autoClose?: NodeJS.Timeout } = {};

  if (reminderMs !== null && reminderMs > 0 && !session.reminder_sent) {
    bucket.reminder = setTimeout(async () => {
      const fresh = SessionStore.get(guildId);
      if (!fresh || fresh.reminder_sent) return;
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(fresh.announce_channel_id).catch(() => null) as TextChannel | null;
      if (channel) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('⏰ Nhắc Nhở Điểm Danh')
              .setColor(Colors.Orange)
              .setDescription(
                `Phiên **${fresh.session_name}** sẽ kết thúc sau **${fresh.reminder_minutes_before_end} phút**.`,
              )
              .setTimestamp(),
          ],
        });
      }
      fresh.reminder_sent = true;
      SessionStore.set(guildId, fresh);
    }, reminderMs);
  }

  if (endMs > 0) {
    bucket.autoClose = setTimeout(async () => {
      const guild = await client.guilds.fetch(guildId);
      await finishSession(guild, 'auto');
    }, endMs);
  }
  timers.set(guildId, bucket);
}

// ─── Attendance Button ────────────────────────────────────────────────────────

async function enforceAttendanceRole(interaction: Interaction): Promise<GuildMember | null> {
  if (!interaction.inCachedGuild()) return null;
  const role = await resolveAllowedRole(interaction.guild);
  if (!role) return null;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return null;
  return member.roles.cache.has(role.id) ? member : null;
}

async function markAttendance(interaction: Interaction, status: AttendanceStatus): Promise<void> {
  if (!interaction.isButton() || !interaction.guild) return;
  const guild = interaction.guild;
  const session = SessionStore.get(guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Hiện không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }

  const member = await enforceAttendanceRole(interaction);
  if (!member) {
    await interaction.reply({
      content: `🚫 Chỉ thành viên có role **${session.role_name}** mới được điểm danh.`,
      ephemeral: true,
    });
    return;
  }

  const old = session.attendees[member.id]?.status;
  session.attendees[member.id] = {
    user_id: member.id,
    name: member.displayName,
    avatar: member.displayAvatarURL(),
    status,
    time: nowTime(),
  };
  SessionStore.set(guild.id, session);
  await updateDisplay(guild);

  const label = status === 'tham_gia' ? '✅ Tham Gia' : '❌ Không Tham Gia';
  const text =
    old && old !== status
      ? `🔄 Đã đổi trạng thái sang **${label}** cho ${interaction.user}.`
      : `${label} — đã điểm danh thành công cho ${interaction.user}!`;
  await interaction.reply({ content: text, ephemeral: true });
}

// ─── Slash Command Definitions ────────────────────────────────────────────────

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('batdau_diemdanh')
      .setDescription('[Admin] Bắt đầu phiên điểm danh mới')
      .addStringOption((o) => o.setName('ten_tran').setDescription('Tên trận / ngày tháng').setRequired(false))
      .addIntegerOption((o) =>
        o.setName('thoi_luong_phut').setDescription('Tự động kết thúc sau bao nhiêu phút').setRequired(false).setMinValue(5).setMaxValue(1440),
      )
      .addIntegerOption((o) =>
        o.setName('nhac_truoc_phut').setDescription('Nhắc trước khi kết thúc bao nhiêu phút').setRequired(false).setMinValue(1).setMaxValue(180),
      )
      .addBooleanOption((o) =>
        o.setName('ping_role').setDescription('Có ping role Bang Chúng khi mở phiên không?').setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName('ket_thuc_diemdanh')
      .setDescription('[Admin] Kết thúc phiên hiện tại (có lưu lịch sử)'),
    new SlashCommandBuilder()
      .setName('huy_diemdanh')
      .setDescription('[Admin] Hủy phiên hiện tại — KHÔNG lưu lịch sử'),
    new SlashCommandBuilder()
      .setName('xoa_diemdanh')
      .setDescription('[Admin] Xóa điểm danh của một thành viên')
      .addUserOption((o) => o.setName('member').setDescription('Thành viên cần xóa').setRequired(true)),
    new SlashCommandBuilder()
      .setName('them_diemdanh')
      .setDescription('[Admin] Thêm điểm danh thủ công')
      .addUserOption((o) => o.setName('member').setDescription('Thành viên cần thêm').setRequired(true))
      .addStringOption((o) =>
        o.setName('trang_thai').setDescription('Trạng thái').setRequired(true).addChoices(
          { name: '✅ Tham Gia', value: 'tham_gia' },
          { name: '❌ Không Tham Gia', value: 'khong_tham_gia' },
        ),
      ),
    new SlashCommandBuilder()
      .setName('sua_diemdanh')
      .setDescription('[Admin] Sửa trạng thái điểm danh hàng loạt')
      .addStringOption((o) =>
        o.setName('trang_thai').setDescription('Trạng thái mới').setRequired(true).addChoices(
          { name: '✅ Tham Gia', value: 'tham_gia' },
          { name: '❌ Không Tham Gia', value: 'khong_tham_gia' },
        ),
      )
      .addUserOption((o) => o.setName('member1').setDescription('Thành viên 1').setRequired(true))
      .addUserOption((o) => o.setName('member2').setDescription('Thành viên 2').setRequired(false))
      .addUserOption((o) => o.setName('member3').setDescription('Thành viên 3').setRequired(false))
      .addUserOption((o) => o.setName('member4').setDescription('Thành viên 4').setRequired(false))
      .addUserOption((o) => o.setName('member5').setDescription('Thành viên 5').setRequired(false)),
    new SlashCommandBuilder()
      .setName('nhac_nho')
      .setDescription('[Admin] Nhắc nhở thành viên chưa điểm danh')
      .addBooleanOption((o) =>
        o.setName('mention').setDescription('Mention @member trong channel (true) hoặc chỉ liệt kê tên (false)').setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName('xem_lich_su_member')
      .setDescription('Xem lịch sử điểm danh cá nhân của một thành viên')
      .addUserOption((o) => o.setName('member').setDescription('Thành viên cần xem (để trống = bản thân)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('thong_ke_phien')
      .setDescription('Xem chi tiết một phiên cụ thể từ lịch sử')
      .addIntegerOption((o) =>
        o.setName('so_phien').setDescription('Số thứ tự phiên (1 = mới nhất, 2 = trước đó...)').setRequired(false).setMinValue(1),
      )
      .addStringOption((o) =>
        o.setName('ten_phien').setDescription('Tìm theo tên phiên (partial match)').setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName('caidat_role')
      .setDescription('[Admin] Cài role được điểm danh')
      .addRoleOption((o) => o.setName('role').setDescription('Role được phép điểm danh').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName('caidat_admin_role')
      .setDescription('[Admin] Cài role được dùng lệnh admin bot')
      .addRoleOption((o) => o.setName('role').setDescription('Role admin bot').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName('caidat_xem')
      .setDescription('[Admin] Xem cấu hình hiện tại')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('xem_diemdanh').setDescription('Xem danh sách hiện tại'),
    new SlashCommandBuilder().setName('lich_su').setDescription('Xem lịch sử các phiên đã kết thúc'),
    new SlashCommandBuilder().setName('thong_ke').setDescription('Xem thống kê thành viên tham gia nhiều nhất'),
    new SlashCommandBuilder().setName('xuat_diemdanh').setDescription('Xuất danh sách điểm danh hiện tại ra file txt'),
  ].map((x) => x.toJSON());
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function handleStart(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;

  const guild = interaction.guild;
  if (SessionStore.get(guild.id)) {
    await interaction.reply({
      content: '⚠️ Đã có phiên điểm danh đang mở! Dùng `/ket_thuc_diemdanh` trước.',
      ephemeral: true,
    });
    return;
  }

  const role = await resolveAllowedRole(guild);
  if (!role) {
    await interaction.reply({
      content: '⚠️ Không tìm thấy role **Bang Chúng**. Hãy dùng `/caidat_role` trước.',
      ephemeral: true,
    });
    return;
  }

  const tenTran = interaction.options.getString('ten_tran') ?? `Bang Chiến ${nowDatetime()}`;
  const duration = interaction.options.getInteger('thoi_luong_phut');
  const reminder = interaction.options.getInteger('nhac_truoc_phut');
  const shouldPingRole = interaction.options.getBoolean('ping_role') ?? true;

  if (duration && reminder && reminder >= duration) {
    await interaction.reply({
      content: '⚠️ `nhac_truoc_phut` phải nhỏ hơn `thoi_luong_phut`.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  await guild.members.fetch();
  const eligibleMemberIds = [...role.members.keys()];

  const displayCh = await getOrCreateDisplayChannel(guild);

  const session: Session = {
    session_name: tenTran,
    attendees: {},
    display_channel_id: displayCh.id,
    display_message_id: null,
    announce_channel_id: interaction.channelId,
    announce_message_id: null,
    role_id: role.id,
    role_name: role.name,
    start_time: nowDatetime(),
    end_time: duration ? toIsoAfterMinutes(duration) : null,
    duration_minutes: duration ?? null,
    reminder_minutes_before_end: reminder ?? null,
    reminder_sent: false,
    ended: false,
    eligible_member_ids: eligibleMemberIds,
  };

  const displayMessage = await displayCh.send({
    embeds: [await buildDisplayEmbed(guild, session)],
    components: [attendanceButtons(false)],
  });
  session.display_message_id = displayMessage.id;
  SessionStore.set(guild.id, session);
  if (duration) scheduleSession(guild.id);

  const announce = new EmbedBuilder()
    .setTitle(`⚔️ Mở Điểm Danh: ${tenTran}`)
    .setColor(Colors.Gold)
    .setDescription(
      [
        `🎯 Role được phép điểm danh: ${role} (${eligibleMemberIds.length} thành viên)`,
        `📊 Kênh hiển thị: ${displayCh}`,
        duration ? `⏳ Tự động kết thúc sau **${duration} phút**` : '⏳ Không đặt tự động kết thúc',
        reminder ? `🔔 Nhắc trước **${reminder} phút**` : '🔔 Không đặt reminder',
      ].join('\n'),
    )
    .setTimestamp();

  const sent = await interaction.followUp({
    content: shouldPingRole ? `${role}` : undefined,
    embeds: [announce],
    components: [attendanceButtons(false)],
    allowedMentions: { roles: shouldPingRole ? [role.id] : [] },
  });
  session.announce_message_id = sent.id;
  SessionStore.set(guild.id, session);
}

async function handleEnd(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  await interaction.deferReply();
  await finishSession(interaction.guild, 'manual');
  await interaction.followUp({ content: '✅ Đã kết thúc phiên điểm danh và lưu lịch sử.' });
}

// ─── /huy_diemdanh — Cancel without saving history ───────────────────────────

async function handleCancel(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  await interaction.deferReply();
  clearGuildTimers(interaction.guild.id);

  // Disable display embed
  try {
    const displayCh = await interaction.guild.channels.fetch(session.display_channel_id) as TextChannel;
    if (session.display_message_id) {
      const msg = await displayCh.messages.fetch(session.display_message_id);
      await msg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🚫 Phiên Bị Hủy: ${session.session_name}`)
            .setColor(Colors.Red)
            .setDescription('Phiên điểm danh đã bị hủy — không lưu lịch sử.')
            .setTimestamp(),
        ],
        components: [attendanceButtons(true)],
      });
    }
  } catch { /* noop */ }

  SessionStore.delete(interaction.guild.id);
  await interaction.followUp({
    content: `🚫 Đã **hủy** phiên **${session.session_name}** — dữ liệu KHÔNG được lưu vào lịch sử.`,
  });
}

async function handleView(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  await interaction.reply({ embeds: [await buildDisplayEmbed(interaction.guild, session)], ephemeral: true });
}

async function handleDelete(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  const user = interaction.options.getUser('member', true);
  if (!session.attendees[user.id]) {
    await interaction.reply({ content: `⚠️ ${user.username} chưa điểm danh!`, ephemeral: true });
    return;
  }
  delete session.attendees[user.id];
  SessionStore.set(interaction.guild.id, session);
  await updateDisplay(interaction.guild);
  await interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${user.username}**.`, ephemeral: true });
}

async function handleManualAdd(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  const user = interaction.options.getUser('member', true);
  const status = interaction.options.getString('trang_thai', true) as AttendanceStatus;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  session.attendees[user.id] = {
    user_id: user.id,
    name: member?.displayName ?? user.username,
    avatar: user.displayAvatarURL(),
    status,
    time: nowTime(),
  };
  SessionStore.set(interaction.guild.id, session);
  await updateDisplay(interaction.guild);
  await interaction.reply({
    content: `✏️ Đã thêm điểm danh cho **${member?.displayName ?? user.username}**.`,
    ephemeral: true,
  });
}

// ─── /sua_diemdanh — Bulk status update ──────────────────────────────────────

async function handleBulkEdit(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }

  const status = interaction.options.getString('trang_thai', true) as AttendanceStatus;
  const slots = ['member1', 'member2', 'member3', 'member4', 'member5'];
  const users = slots
    .map((s) => interaction.options.getUser(s))
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (users.length === 0) {
    await interaction.reply({ content: '⚠️ Cần chọn ít nhất 1 thành viên!', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const label = status === 'tham_gia' ? '✅ Tham Gia' : '❌ Không Tham Gia';
  const updated: string[] = [];

  for (const user of users) {
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    session.attendees[user.id] = {
      user_id: user.id,
      name: member?.displayName ?? user.username,
      avatar: user.displayAvatarURL(),
      status,
      time: nowTime(),
    };
    updated.push(member?.displayName ?? user.username);
  }

  SessionStore.set(interaction.guild.id, session);
  await updateDisplay(interaction.guild);
  await interaction.followUp({
    content: `✏️ Đã cập nhật **${label}** cho ${updated.length} thành viên:\n${updated.map((n) => `• ${n}`).join('\n')}`,
    ephemeral: true,
  });
}

// ─── /nhac_nho ────────────────────────────────────────────────────────────────

async function handleRemind(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  if (!await assertAdmin(interaction)) return;
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const shouldMention = interaction.options.getBoolean('mention') ?? false;

  const checkedIds = new Set(Object.keys(session.attendees));
  const role = session.role_id
    ? await interaction.guild.roles.fetch(session.role_id).catch(() => null)
    : null;

  let absentIds: string[];
  if (role) {
    await interaction.guild.members.fetch();
    absentIds = [...role.members.keys()].filter((id) => !checkedIds.has(id));
  } else {
    absentIds = session.eligible_member_ids.filter((id) => !checkedIds.has(id));
  }

  if (absentIds.length === 0) {
    await interaction.followUp({ content: '✅ Tất cả thành viên đã điểm danh rồi!', ephemeral: true });
    return;
  }

  const channel = interaction.channel as TextChannel;

  if (shouldMention) {
    for (let i = 0; i < absentIds.length; i += 10) {
      const batch = absentIds.slice(i, i + 10);
      await channel.send({
        content: `🔔 **Nhắc nhở điểm danh phiên "${session.session_name}":**\n${batch.map((id) => `<@${id}>`).join(' ')}\nHãy bấm nút điểm danh ngay nhé!`,
        allowedMentions: { users: batch },
      });
    }
    await interaction.followUp({
      content: `🔔 Đã mention **${absentIds.length}** thành viên chưa điểm danh.`,
      ephemeral: true,
    });
  } else {
    const names: string[] = [];
    for (const id of absentIds) {
      const member = interaction.guild.members.cache.get(id);
      names.push(member ? member.displayName : `<@${id}>`);
    }
    const embed = new EmbedBuilder()
      .setTitle(`⏳ Chưa Điểm Danh — ${absentIds.length} người`)
      .setColor(Colors.Orange)
      .setDescription(names.map((n, i) => `\`${String(i + 1).padStart(2)}.\` ${n}`).join('\n'))
      .setFooter({ text: `Phiên: ${session.session_name}` })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
    await interaction.followUp({
      content: `📋 Đã gửi danh sách **${absentIds.length}** người chưa điểm danh.`,
      ephemeral: true,
    });
  }
}

// ─── /xem_lich_su_member — Personal history ───────────────────────────────────

async function handleMemberHistory(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('member') ?? interaction.user;
  const stats = MemberStatsStore.get(interaction.guild.id, targetUser.id);
  const history = HistoryStore.get(interaction.guild.id);

  // Collect sessions where user participated or declined
  const participated = history.filter((s) => s.attendees[targetUser.id] !== undefined);

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  const displayName = member?.displayName ?? targetUser.username;

  if (!stats && participated.length === 0) {
    await interaction.followUp({
      content: `📭 Chưa có dữ liệu điểm danh nào cho **${displayName}**.`,
      ephemeral: true,
    });
    return;
  }

  const joined = stats?.joined ?? participated.filter((s) => s.attendees[targetUser.id]?.status === 'tham_gia').length;
  const total = stats?.total_sessions ?? participated.length;
  const pct = total > 0 ? Math.round((joined / total) * 100) : 0;
  const currentStreak = stats?.current_streak ?? 0;
  const maxStreak = stats?.max_streak ?? 0;

  // Bar visualization
  const BAR_LEN = 10;
  const filled = Math.round((pct / 100) * BAR_LEN);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_LEN - filled);

  // Recent 10 sessions
  const recent = participated.slice(-10).reverse();
  const recentLines = recent.map((s) => {
    const att = s.attendees[targetUser.id];
    const icon = att.status === 'tham_gia' ? '✅' : '❌';
    return `${icon} **${s.session_name}** — ${s.start_time}`;
  });

  // Milestone badges
  const MILESTONES = [5, 10, 20, 30, 50, 100];
  const badges = MILESTONES
    .filter((m) => joined >= m)
    .map((m) => `${MILESTONE_EMOJI[m] ?? '🎖️'} ${m} phiên`)
    .join('  ');

  const embed = new EmbedBuilder()
    .setTitle(`📋 Lịch Sử Điểm Danh — ${displayName}`)
    .setColor(Colors.Blue)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      {
        name: '📊 Tổng Quan',
        value: [
          `Tổng phiên: **${total}**`,
          `Tham gia: **${joined}** | Không tham gia: **${(stats?.declined ?? (total - joined))}**`,
          `Tỷ lệ: **${pct}%** \`${bar}\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔥 Streak',
        value: [
          `Streak hiện tại: **${currentStreak}** phiên liên tiếp`,
          `Streak cao nhất: **${maxStreak}** phiên`,
        ].join('\n'),
        inline: false,
      },
    );

  if (badges) {
    embed.addFields({ name: '🏅 Huy Hiệu', value: badges, inline: false });
  }

  if (recentLines.length > 0) {
    embed.addFields({
      name: `📅 10 Phiên Gần Nhất (${participated.length} tổng)`,
      value: recentLines.join('\n'),
      inline: false,
    });
  }

  embed.setTimestamp();
  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

// ─── /thong_ke_phien — Detailed session from history ─────────────────────────

async function handleSessionDetail(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const history = HistoryStore.get(interaction.guild.id);
  if (history.length === 0) {
    await interaction.followUp({ content: '📭 Chưa có phiên nào trong lịch sử.', ephemeral: true });
    return;
  }

  const soPhien = interaction.options.getInteger('so_phien');
  const tenPhien = interaction.options.getString('ten_phien');

  let target: HistorySession | undefined;

  if (tenPhien) {
    target = [...history].reverse().find(
      (s) => s.session_name.toLowerCase().includes(tenPhien.toLowerCase()),
    );
    if (!target) {
      await interaction.followUp({ content: `⚠️ Không tìm thấy phiên nào có tên chứa "${tenPhien}".`, ephemeral: true });
      return;
    }
  } else {
    const idx = history.length - (soPhien ?? 1);
    if (idx < 0) {
      await interaction.followUp({ content: `⚠️ Chỉ có **${history.length}** phiên trong lịch sử.`, ephemeral: true });
      return;
    }
    target = history[idx];
  }

  const attendees = Object.values(target.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');
  const eligible = target.eligible_count ?? attendees.length;
  const pct = eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0;

  const BAR_LEN = 10;
  const filled = Math.round((pct / 100) * BAR_LEN);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_LEN - filled);

  const joinedList = joined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name} (${x.time})`).join('\n') || '—';
  const declinedList = declined.map((x, i) => `\`${String(i + 1).padStart(2)}.\` ${x.name}`).join('\n') || '—';

  const embed = new EmbedBuilder()
    .setTitle(`📋 Chi Tiết Phiên: ${target.session_name}`)
    .setColor(Colors.Blue)
    .addFields(
      {
        name: '📊 Tổng Quan',
        value: [
          `Bắt đầu: **${target.start_time}**`,
          `Kết thúc: **${target.end_time}**`,
          `Role: **${target.role_name}**`,
          `Tỷ lệ: **${pct}%** \`${bar}\` (${joined.length}/${eligible})`,
        ].join('\n'),
        inline: false,
      },
    );

  // Split long lists across fields (Discord 1024 char limit per field)
  const chunkField = (title: string, content: string, color = false) => {
    const lines = content.split('\n');
    const chunks: string[] = [];
    let cur = '';
    for (const l of lines) {
      if ((cur + '\n' + l).length > 950) { chunks.push(cur); cur = l; }
      else cur = cur ? cur + '\n' + l : l;
    }
    if (cur) chunks.push(cur);
    return chunks.map((c, i) => ({ name: i === 0 ? title : '\u200b', value: c, inline: false }));
  };

  embed.addFields(...chunkField(`✅ Tham Gia (${joined.length})`, joinedList));
  embed.addFields(...chunkField(`❌ Không Tham Gia (${declined.length})`, declinedList));
  embed.setTimestamp();

  await interaction.followUp({ embeds: [embed], ephemeral: true });
}

async function handleHistory(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const history = HistoryStore.get(interaction.guild.id);
  await interaction.reply({ embeds: [buildHistoryEmbed(history)], ephemeral: true });
}

async function handleStats(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const history = HistoryStore.get(interaction.guild.id);
  const stats = new Map<string, { name: string; joined: number; declined: number; total: number }>();
  for (const session of history) {
    for (const item of Object.values(session.attendees)) {
      const row = stats.get(item.user_id) ?? { name: item.name, joined: 0, declined: 0, total: 0 };
      row.total += 1;
      if (item.status === 'tham_gia') row.joined += 1;
      if (item.status === 'khong_tham_gia') row.declined += 1;
      stats.set(item.user_id, row);
    }
  }
  const top = [...stats.values()]
    .sort((a, b) => b.joined - a.joined || b.total - a.total)
    .slice(0, 10);
  const lines = top.map(
    (x, i) => `**${i + 1}. ${x.name}** — ${x.joined} tham gia, ${x.declined} không tham gia, tổng ${x.total} phiên`,
  );
  await interaction.reply({
    embeds: [buildStatsEmbed('📈 Thống Kê Thành Viên', lines)],
    ephemeral: true,
  });
}

async function handleExport(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const session = SessionStore.get(interaction.guild.id);
  if (!session) {
    await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }
  const attendees = Object.values(session.attendees);
  const joined = attendees.filter((x) => x.status === 'tham_gia');
  const declined = attendees.filter((x) => x.status === 'khong_tham_gia');
  const eligible = session.eligible_member_ids.length;
  const lines = [
    `PHIÊN: ${session.session_name}`,
    `BẮT ĐẦU: ${session.start_time}`,
    `ROLE: ${session.role_name}`,
    `ELIGIBLE: ${eligible} thành viên`,
    '',
    `THAM GIA (${joined.length})`,
    ...joined.map((x, i) => `${i + 1}. ${x.name} - ${x.time}`),
    '',
    `KHÔNG THAM GIA (${declined.length})`,
    ...declined.map((x, i) => `${i + 1}. ${x.name} - ${x.time}`),
    '',
    `TỶ LỆ: ${eligible > 0 ? Math.round((joined.length / eligible) * 100) : 0}% (${joined.length}/${eligible})`,
  ].join('\n');
  const file = new AttachmentBuilder(Buffer.from(lines, 'utf-8'), { name: 'diemdanh.txt' });
  await interaction.reply({ content: '📦 File export điểm danh:', files: [file], ephemeral: true });
}

async function handleConfigAttendanceRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const role = interaction.options.getRole('role', true) as Role;
  const cfg = ConfigStore.get(interaction.guild.id);
  ConfigStore.set(interaction.guild.id, { ...cfg, allowed_role_id: role.id, allowed_role_name: role.name });
  const adminRole = await resolveAdminRole(interaction.guild);
  await interaction.reply({
    embeds: [buildConfigEmbed(ConfigStore.get(interaction.guild.id), role, adminRole)],
    ephemeral: true,
  });
}

async function handleConfigAdminRole(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const role = interaction.options.getRole('role', true) as Role;
  const cfg = ConfigStore.get(interaction.guild.id);
  ConfigStore.set(interaction.guild.id, { ...cfg, admin_role_id: role.id, admin_role_name: role.name });
  const attendanceRole = await resolveAllowedRole(interaction.guild);
  await interaction.reply({
    embeds: [buildConfigEmbed(ConfigStore.get(interaction.guild.id), attendanceRole, role)],
    ephemeral: true,
  });
}

async function handleConfigView(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const cfg = ConfigStore.get(interaction.guild.id);
  const [attendanceRole, adminRole] = await Promise.all([
    resolveAllowedRole(interaction.guild),
    resolveAdminRole(interaction.guild),
  ]);
  await interaction.reply({
    embeds: [buildConfigEmbed(cfg, attendanceRole, adminRole)],
    ephemeral: true,
  });
}

// ─── Bot Entry ────────────────────────────────────────────────────────────────

client.once('clientReady', async (readyClient) => {
  console.log(`🤖 Bot đã online: ${readyClient.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(readyClient.user.id), { body: buildCommands() });
  console.log('✅ Đã sync slash commands');
  for (const [guildId, session] of Object.entries(SessionStore.all())) {
    if (session.end_time && new Date(session.end_time).getTime() > Date.now()) {
      scheduleSession(guildId);
      console.log(`🔄 Đã reschedule session: ${session.session_name} (guild ${guildId})`);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_tham_gia') await markAttendance(interaction, 'tham_gia');
      else if (interaction.customId === 'btn_khong_tham_gia') await markAttendance(interaction, 'khong_tham_gia');
      return;
    }

    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;

    switch (interaction.commandName) {
      case 'batdau_diemdanh':     await handleStart(interaction); break;
      case 'ket_thuc_diemdanh':   await handleEnd(interaction); break;
      case 'huy_diemdanh':        await handleCancel(interaction); break;
      case 'xem_diemdanh':        await handleView(interaction); break;
      case 'xoa_diemdanh':        await handleDelete(interaction); break;
      case 'them_diemdanh':       await handleManualAdd(interaction); break;
      case 'sua_diemdanh':        await handleBulkEdit(interaction); break;
      case 'nhac_nho':            await handleRemind(interaction); break;
      case 'xem_lich_su_member':  await handleMemberHistory(interaction); break;
      case 'thong_ke_phien':      await handleSessionDetail(interaction); break;
      case 'lich_su':             await handleHistory(interaction); break;
      case 'thong_ke':            await handleStats(interaction); break;
      case 'xuat_diemdanh':       await handleExport(interaction); break;
      case 'caidat_role':         await handleConfigAttendanceRole(interaction); break;
      case 'caidat_admin_role':   await handleConfigAdminRole(interaction); break;
      case 'caidat_xem':          await handleConfigView(interaction); break;
    }
  } catch (error) {
    console.error(error);
    const message = '❌ Có lỗi xảy ra khi xử lý lệnh.';
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred)
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
      else
        await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  }
});

client.login(TOKEN);
