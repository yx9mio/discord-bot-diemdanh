/**
 * Discord Bot — Điểm Danh Bang Chiến
 * TypeScript rewrite using discord.js v14
 */

import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  ChannelType,
  OverwriteType,
  Colors,
} from 'discord.js';
import { SessionStore } from './storage.js';
import { Session, AttendeeRecord } from './types.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('❌ Thiếu DISCORD_TOKEN trong .env');

// ── Client ────────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ── Slash Commands definitions ────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('batdau_diemdanh')
    .setDescription('[Admin] Bắt đầu phiên điểm danh bang chiến mới')
    .addStringOption((o) =>
      o.setName('ten_tran').setDescription('Tên trận / ngày tháng (VD: Tối 11/04/2026)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('ket_thuc_diemdanh')
    .setDescription('[Admin] Kết thúc phiên điểm danh hiện tại')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('xem_diemdanh')
    .setDescription('Xem danh sách điểm danh hiện tại'),

  new SlashCommandBuilder()
    .setName('xoa_diemdanh')
    .setDescription('[Admin] Xóa điểm danh của một thành viên')
    .addUserOption((o) => o.setName('member').setDescription('Thành viên cần xóa').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('them_diemdanh')
    .setDescription('[Admin] Thêm điểm danh thủ công cho thành viên')
    .addUserOption((o) => o.setName('member').setDescription('Thành viên cần thêm').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('trang_thai')
        .setDescription('Trạng thái điểm danh')
        .setRequired(true)
        .addChoices(
          { name: '✅ Tham Gia', value: 'tham_gia' },
          { name: '❌ Không Tham Gia', value: 'khong_tham_gia' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

// ── Helpers ───────────────────────────────────────────────────────────────────
function now(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

function nowDatetime(): string {
  return new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function buildAttendanceRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_tham_gia')
      .setLabel('✅  Tham Gia')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_khong_tham_gia')
      .setLabel('❌  Không Tham Gia')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildDisplayEmbed(session: Session, closed = false): EmbedBuilder {
  const { attendees, session_name, start_time } = session;
  const thamGia = Object.values(attendees).filter((a) => a.status === 'tham_gia');
  const khongThamGia = Object.values(attendees).filter((a) => a.status === 'khong_tham_gia');

  const prefix = closed ? '🏆 [ĐÃ KẾT THÚC]' : '📋 Điểm Danh Bang Chiến';
  const color = closed ? Colors.Green : Colors.Blurple;

  const tgText =
    thamGia.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name}  *(lúc ${d.time})*`).join('\n') ||
    '_Chưa có ai_';

  const ktgText =
    khongThamGia.map((d, i) => `\`${String(i + 1).padStart(2)}.\` ${d.name}  *(lúc ${d.time})*`).join('\n') ||
    '_Chưa có ai_';

  return new EmbedBuilder()
    .setTitle(`${prefix}: ${session_name}`)
    .setColor(color)
    .setTimestamp()
    .addFields(
      { name: `✅  Tham Gia  —  **${thamGia.length}**`, value: tgText, inline: false },
      { name: `❌  Không Tham Gia  —  **${khongThamGia.length}**`, value: ktgText, inline: false }
    )
    .setFooter({ text: `Tổng đã điểm danh: ${Object.keys(attendees).length} thành viên  •  Bắt đầu: ${start_time}` });
}

async function getOrCreateDisplayChannel(guildId: string): Promise<TextChannel> {
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const existing = channels.find(
    (ch) => ch?.type === ChannelType.GuildText && ch.name === 'diemdanh-bang-chien'
  ) as TextChannel | undefined;
  if (existing) return existing;

  const created = await guild.channels.create({
    name: 'diemdanh-bang-chien',
    type: ChannelType.GuildText,
    topic: '📋 Danh sách điểm danh Bang Chiến — Tự động cập nhật',
    reason: 'Bot tạo channel hiển thị điểm danh',
    permissionOverwrites: [
      { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: ['SendMessages', 'AddReactions'] },
      { id: client.user!.id, type: OverwriteType.Member, allow: ['SendMessages', 'ManageMessages'] },
    ],
  });
  return created as TextChannel;
}

async function updateDisplay(guildId: string): Promise<void> {
  const session = SessionStore.get(guildId);
  if (!session || !session.display_message_id) return;
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(session.display_channel_id)) as TextChannel;
    const msg = await channel.messages.fetch(session.display_message_id);
    await msg.edit({ embeds: [buildDisplayEmbed(session)] });
  } catch {
    // ignore stale message
  }
}

async function markAttendance(
  interaction: Interaction,
  status: 'tham_gia' | 'khong_tham_gia'
): Promise<void> {
  if (!interaction.isButton()) return;
  const guildId = interaction.guildId!;
  const session = SessionStore.get(guildId);
  if (!session) {
    await interaction.reply({ content: '⚠️ Hiện không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }

  const uid = interaction.user.id;
  const oldStatus = session.attendees[uid]?.status ?? null;

  session.attendees[uid] = {
    name: interaction.member
      ? (interaction.member as { displayName?: string }).displayName ?? interaction.user.username
      : interaction.user.username,
    avatar: interaction.user.displayAvatarURL(),
    status,
    time: now(),
  } as AttendeeRecord;

  SessionStore.set(guildId, session);
  await updateDisplay(guildId);

  const label = status === 'tham_gia' ? '✅ Tham Gia' : '❌ Không Tham Gia';
  const msg =
    oldStatus && oldStatus !== status
      ? `🔄 Đã **đổi** điểm danh sang **${label}** cho ${interaction.user}!`
      : `${label} — đã điểm danh thành công cho ${interaction.user}!`;

  await interaction.reply({ content: msg, ephemeral: true });
}

// ── Event: ready ──────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`🤖 Bot đã online: ${client.user?.tag}  (ID: ${client.user?.id})`);
  console.log('─'.repeat(40));

  const rest = new REST().setToken(TOKEN!);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log(`✅ Synced ${commands.length} slash commands (global)`);
  } catch (err) {
    console.error('❌ Lỗi sync commands:', err);
  }
});

// ── Event: interactionCreate ──────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // ── Buttons ──
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_tham_gia') await markAttendance(interaction, 'tham_gia');
    if (interaction.customId === 'btn_khong_tham_gia') await markAttendance(interaction, 'khong_tham_gia');
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const guildId = interaction.guildId!;

  // ── /batdau_diemdanh ──
  if (interaction.commandName === 'batdau_diemdanh') {
    if (SessionStore.get(guildId)) {
      await interaction.reply({ content: '⚠️ Đã có phiên điểm danh đang mở! Dùng `/ket_thuc_diemdanh` trước.', ephemeral: true });
      return;
    }

    const tenTran = interaction.options.getString('ten_tran') ?? `Bang Chiến ${nowDatetime()}`;
    await interaction.deferReply();

    const displayCh = await getOrCreateDisplayChannel(guildId);

    const session: Session = {
      session_name: tenTran,
      attendees: {},
      display_channel_id: displayCh.id,
      display_message_id: null,
      start_time: nowDatetime(),
    };

    const initMsg = await displayCh.send({ embeds: [buildDisplayEmbed(session)] });
    session.display_message_id = initMsg.id;
    SessionStore.set(guildId, session);

    const announceEmbed = new EmbedBuilder()
      .setTitle(`⚔️  Mở Điểm Danh: ${tenTran}`)
      .setDescription(`Nhấn nút bên dưới để điểm danh!\n\n📊 Kết quả cập nhật tại ${displayCh}`)
      .setColor(Colors.Gold)
      .setTimestamp()
      .setFooter({ text: 'Chỉ thành viên trong server mới có thể điểm danh' });

    await interaction.followUp({ embeds: [announceEmbed], components: [buildAttendanceRow()] });
    return;
  }

  // ── /ket_thuc_diemdanh ──
  if (interaction.commandName === 'ket_thuc_diemdanh') {
    const session = SessionStore.get(guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    await interaction.deferReply();

    if (session.display_message_id) {
      try {
        const guild = await client.guilds.fetch(guildId);
        const ch = (await guild.channels.fetch(session.display_channel_id)) as TextChannel;
        const msg = await ch.messages.fetch(session.display_message_id);
        await msg.edit({ embeds: [buildDisplayEmbed(session, true)] });
      } catch { /* ignore */ }
    }

    const attendees = session.attendees;
    const thamGia = Object.values(attendees).filter((a) => a.status === 'tham_gia').length;
    const khongThamGia = Object.values(attendees).filter((a) => a.status === 'khong_tham_gia').length;

    const summary = new EmbedBuilder()
      .setTitle(`🏁  Kết Thúc Điểm Danh: ${session.session_name}`)
      .setColor(Colors.Green)
      .setTimestamp()
      .addFields(
        { name: '✅ Tham Gia', value: String(thamGia), inline: true },
        { name: '❌ Không Tham Gia', value: String(khongThamGia), inline: true },
        { name: '📊 Tổng Cộng', value: String(Object.keys(attendees).length), inline: true }
      );

    SessionStore.delete(guildId);
    await interaction.followUp({ embeds: [summary] });
    return;
  }

  // ── /xem_diemdanh ──
  if (interaction.commandName === 'xem_diemdanh') {
    const session = SessionStore.get(guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [buildDisplayEmbed(session)], ephemeral: true });
    return;
  }

  // ── /xoa_diemdanh ──
  if (interaction.commandName === 'xoa_diemdanh') {
    const session = SessionStore.get(guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    const member = interaction.options.getUser('member', true);
    if (!session.attendees[member.id]) {
      await interaction.reply({ content: `⚠️ ${member.username} chưa điểm danh!`, ephemeral: true });
      return;
    }
    delete session.attendees[member.id];
    SessionStore.set(guildId, session);
    await updateDisplay(guildId);
    await interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${member.username}**.`, ephemeral: true });
    return;
  }

  // ── /them_diemdanh ──
  if (interaction.commandName === 'them_diemdanh') {
    const session = SessionStore.get(guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    const member = interaction.options.getUser('member', true);
    const trangThai = interaction.options.getString('trang_thai', true) as 'tham_gia' | 'khong_tham_gia';
    const guildMember = await (await client.guilds.fetch(guildId)).members.fetch(member.id).catch(() => null);

    session.attendees[member.id] = {
      name: guildMember?.displayName ?? member.username,
      avatar: member.displayAvatarURL(),
      status: trangThai,
      time: now(),
    };
    SessionStore.set(guildId, session);
    await updateDisplay(guildId);

    const label = trangThai === 'tham_gia' ? '✅ Tham Gia' : '❌ Không Tham Gia';
    await interaction.reply({ content: `✏️ Đã thêm điểm danh **${label}** cho **${guildMember?.displayName ?? member.username}**.`, ephemeral: true });
    return;
  }
});

client.login(TOKEN);
