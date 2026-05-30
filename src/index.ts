import 'dotenv/config';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Colors,
  EmbedBuilder,
  GatewayIntentBits,
  GuildMember,
  Interaction,
  OverwriteType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { buildAttendanceEmbed, buildHistoryEmbed, buildStatsEmbed, buildSummaryEmbed } from './embeds.js';
import { Store } from './storage.js';
import { AttendeeRecord, HistorySession, Session } from './types.js';
import { addMinutesIso, buildExportAttachment, hasRequiredRole, nowDateTime, nowTime, toLocalDateTime } from './utils.js';

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error('❌ Thiếu DISCORD_TOKEN trong .env');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const commands = [
  new SlashCommandBuilder()
    .setName('batdau_diemdanh')
    .setDescription('[Admin] Bắt đầu phiên điểm danh bang chiến mới')
    .addStringOption((o) => o.setName('ten_tran').setDescription('Tên phiên').setRequired(false))
    .addIntegerOption((o) => o.setName('reminder').setDescription('Nhắc trước bao nhiêu phút').setRequired(false).setMinValue(1).setMaxValue(240))
    .addIntegerOption((o) => o.setName('tu_dong_dong').setDescription('Tự đóng sau bao nhiêu phút').setRequired(false).setMinValue(1).setMaxValue(720))
    .addRoleOption((o) => o.setName('ping_role').setDescription('Role sẽ được ping khi mở phiên').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('ket_thuc_diemdanh')
    .setDescription('[Admin] Kết thúc phiên điểm danh hiện tại')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('xem_diemdanh').setDescription('Xem danh sách điểm danh hiện tại'),

  new SlashCommandBuilder()
    .setName('them_diemdanh')
    .setDescription('[Admin] Thêm điểm danh thủ công cho thành viên')
    .addUserOption((o) => o.setName('member').setDescription('Thành viên').setRequired(true))
    .addStringOption((o) =>
      o
        .setName('trang_thai')
        .setDescription('Trạng thái')
        .setRequired(true)
        .addChoices(
          { name: '✅ Tham Gia', value: 'tham_gia' },
          { name: '❌ Không Tham Gia', value: 'khong_tham_gia' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('xoa_diemdanh')
    .setDescription('[Admin] Xóa điểm danh của một thành viên')
    .addUserOption((o) => o.setName('member').setDescription('Thành viên').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('lich_su').setDescription('Xem lịch sử các phiên điểm danh đã kết thúc'),
  new SlashCommandBuilder().setName('thong_ke').setDescription('Xem thống kê thành viên tham gia nhiều nhất'),
  new SlashCommandBuilder().setName('export_diemdanh').setDescription('Export danh sách điểm danh hiện tại ra file txt'),
].map((c) => c.toJSON());

function attendanceButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('btn_tham_gia').setLabel('✅ Tham Gia').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_khong_tham_gia').setLabel('❌ Không Tham Gia').setStyle(ButtonStyle.Danger)
  );
}

async function getOrCreateDisplayChannel(guildId: string): Promise<TextChannel> {
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const found = channels.find((c) => c?.type === ChannelType.GuildText && c.name === 'diemdanh-bang-chien') as TextChannel | undefined;
  if (found) return found;

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

async function updateDisplay(guildId: string, closed = false): Promise<void> {
  const session = Store.getSession(guildId);
  if (!session || !session.display_message_id) return;
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(session.display_channel_id)) as TextChannel;
    const message = await channel.messages.fetch(session.display_message_id);
    await message.edit({ embeds: [buildAttendanceEmbed(session, closed)] });
  } catch {
    // ignore
  }
}

async function closeSession(guildId: string, reason = 'manual'): Promise<HistorySession | null> {
  const session = Store.getSession(guildId);
  if (!session) return null;

  const attendees = Object.values(session.attendees);
  const totalThamGia = attendees.filter((a) => a.status === 'tham_gia').length;
  const totalKhongThamGia = attendees.filter((a) => a.status === 'khong_tham_gia').length;

  await updateDisplay(guildId, true);

  const history: HistorySession = {
    ...session,
    ended_at: nowDateTime(),
    total_tham_gia: totalThamGia,
    total_khong_tham_gia: totalKhongThamGia,
    total_attendees: attendees.length,
  };

  Store.appendHistory(guildId, history);
  Store.deleteSession(guildId);

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(session.announce_channel_id)) as TextChannel;
    await channel.send({
      content: reason === 'auto' ? '⏰ Phiên điểm danh đã tự động đóng theo deadline.' : undefined,
      embeds: [buildSummaryEmbed(history)],
    });
  } catch {
    // ignore
  }

  return history;
}

async function markAttendance(interaction: Interaction, status: 'tham_gia' | 'khong_tham_gia') {
  if (!interaction.isButton() || !interaction.guildId || !interaction.member) return;
  const session = Store.getSession(interaction.guildId);
  if (!session) {
    await interaction.reply({ content: '⚠️ Hiện không có phiên điểm danh nào đang mở!', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const roleNames = member.roles.cache.map((r) => r.name);
  if (!hasRequiredRole(roleNames, session.allowed_role_name)) {
    await interaction.reply({ content: `🚫 Chỉ role **${session.allowed_role_name}** mới được điểm danh.`, ephemeral: true });
    return;
  }

  const oldStatus = session.attendees[interaction.user.id]?.status;
  session.attendees[interaction.user.id] = {
    userId: interaction.user.id,
    name: member.displayName,
    avatar: interaction.user.displayAvatarURL(),
    status,
    time: nowTime(),
  } as AttendeeRecord;

  Store.setSession(interaction.guildId, session);
  await updateDisplay(interaction.guildId);

  const label = status === 'tham_gia' ? '✅ Tham Gia' : '❌ Không Tham Gia';
  await interaction.reply({
    content: oldStatus && oldStatus !== status
      ? `🔄 Đã đổi trạng thái sang **${label}** cho ${interaction.user}.`
      : `${label} — đã điểm danh thành công cho ${interaction.user}!`,
    ephemeral: true,
  });
}

async function reminderLoop() {
  setInterval(async () => {
    const guilds = client.guilds.cache.map((g) => g.id);
    for (const guildId of guilds) {
      const session = Store.getSession(guildId);
      if (!session) continue;

      if (session.auto_close_at && new Date(session.auto_close_at).getTime() <= Date.now()) {
        await closeSession(guildId, 'auto');
        continue;
      }

      if (
        session.reminder_minutes &&
        session.auto_close_at &&
        !session.reminder_sent &&
        new Date(session.auto_close_at).getTime() - Date.now() <= session.reminder_minutes * 60_000
      ) {
        try {
          const guild = await client.guilds.fetch(guildId);
          const channel = (await guild.channels.fetch(session.announce_channel_id)) as TextChannel;
          await channel.send({
            content: `⏰ Nhắc nhở: phiên **${session.session_name}** sẽ tự đóng sau **${session.reminder_minutes} phút**.`,
          });
          session.reminder_sent = true;
          Store.setSession(guildId, session);
        } catch {
          // ignore
        }
      }
    }
  }, 15_000);
}

client.once('ready', async () => {
  console.log(`🤖 Bot đã online: ${client.user?.tag}`);
  const rest = new REST().setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
  console.log(`✅ Synced ${commands.length} slash commands`);
  reminderLoop();
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_tham_gia') await markAttendance(interaction, 'tham_gia');
    if (interaction.customId === 'btn_khong_tham_gia') await markAttendance(interaction, 'khong_tham_gia');
    return;
  }

  if (!interaction.isChatInputCommand() || !interaction.guildId || !interaction.channelId) return;

  if (interaction.commandName === 'batdau_diemdanh') {
    if (Store.getSession(interaction.guildId)) {
      await interaction.reply({ content: '⚠️ Đã có phiên điểm danh đang mở! Dùng `/ket_thuc_diemdanh` trước.', ephemeral: true });
      return;
    }

    const tenTran = interaction.options.getString('ten_tran') ?? `Bang Chiến ${nowDateTime()}`;
    const reminder = interaction.options.getInteger('reminder');
    const autoClose = interaction.options.getInteger('tu_dong_dong');
    const pingRole = interaction.options.getRole('ping_role');
    const displayCh = await getOrCreateDisplayChannel(interaction.guildId);

    const session: Session = {
      session_name: tenTran,
      attendees: {},
      display_channel_id: displayCh.id,
      display_message_id: null,
      announce_channel_id: interaction.channelId,
      announce_message_id: null,
      allowed_role_name: 'Bang Chúng',
      ping_role_id: pingRole?.id ?? null,
      reminder_minutes: reminder ?? null,
      reminder_sent: false,
      auto_close_at: autoClose ? addMinutesIso(autoClose) : null,
      created_by: interaction.user.id,
      start_time: nowDateTime(),
    };

    const displayMsg = await displayCh.send({ embeds: [buildAttendanceEmbed(session)], components: [attendanceButtons()] });
    session.display_message_id = displayMsg.id;
    Store.setSession(interaction.guildId, session);

    const openEmbed = new EmbedBuilder()
      .setTitle(`🚀 Mở Phiên Điểm Danh • ${tenTran}`)
      .setColor(Colors.Gold)
      .setDescription([
        `Role được phép điểm danh: **Bang Chúng**`,
        reminder ? `Reminder: **${reminder} phút** trước khi đóng` : 'Reminder: **Không**',
        autoClose ? `Tự đóng sau: **${autoClose} phút**` : 'Tự đóng: **Không**',
        `Kênh cập nhật: ${displayCh}`,
      ].join('\n'))
      .setTimestamp();

    await interaction.reply({
      content: pingRole ? `${pingRole}` : undefined,
      embeds: [openEmbed],
      components: [attendanceButtons()],
    });
    return;
  }

  if (interaction.commandName === 'ket_thuc_diemdanh') {
    const history = await closeSession(interaction.guildId, 'manual');
    if (!history) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [buildSummaryEmbed(history)], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'xem_diemdanh') {
    const session = Store.getSession(interaction.guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [buildAttendanceEmbed(session)], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'them_diemdanh') {
    const session = Store.getSession(interaction.guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    const memberUser = interaction.options.getUser('member', true);
    const guildMember = await interaction.guild!.members.fetch(memberUser.id).catch(() => null);
    const status = interaction.options.getString('trang_thai', true) as 'tham_gia' | 'khong_tham_gia';
    session.attendees[memberUser.id] = {
      userId: memberUser.id,
      name: guildMember?.displayName ?? memberUser.username,
      avatar: memberUser.displayAvatarURL(),
      status,
      time: nowTime(),
    };
    Store.setSession(interaction.guildId, session);
    await updateDisplay(interaction.guildId);
    await interaction.reply({ content: `✏️ Đã thêm điểm danh cho **${guildMember?.displayName ?? memberUser.username}**.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'xoa_diemdanh') {
    const session = Store.getSession(interaction.guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    const memberUser = interaction.options.getUser('member', true);
    if (!session.attendees[memberUser.id]) {
      await interaction.reply({ content: `⚠️ ${memberUser.username} chưa điểm danh!`, ephemeral: true });
      return;
    }
    delete session.attendees[memberUser.id];
    Store.setSession(interaction.guildId, session);
    await updateDisplay(interaction.guildId);
    await interaction.reply({ content: `🗑️ Đã xóa điểm danh của **${memberUser.username}**.`, ephemeral: true });
    return;
  }

  if (interaction.commandName === 'lich_su') {
    const history = Store.getHistory(interaction.guildId);
    await interaction.reply({ embeds: [buildHistoryEmbed(history)], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'thong_ke') {
    const stats = Store.getStats(interaction.guildId);
    await interaction.reply({ embeds: [buildStatsEmbed(stats)], ephemeral: true });
    return;
  }

  if (interaction.commandName === 'export_diemdanh') {
    const session = Store.getSession(interaction.guildId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Không có phiên điểm danh nào đang mở!', ephemeral: true });
      return;
    }
    await interaction.reply({ files: [buildExportAttachment(session)], ephemeral: true });
    return;
  }
});

client.login(TOKEN);
