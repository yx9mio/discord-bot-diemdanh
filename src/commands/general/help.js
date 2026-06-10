'use strict';
const { Command } = require('@sapphire/framework');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { CATEGORIES, byAudience } = require('../../../utils/commands.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const configService = require('../../../services/configService.js');
const sessionService = require('../../../services/sessionService.js');
const log = require('../../../utils/logger.js');

const CUSTOM_ID = {
  USER_PAGE:  'help:page:user',
  ADMIN_PAGE: 'help:page:admin',
};

const COLOR = { USER: 0x57f287, ADMIN: 0xfee75c };

function buildQuickStart() {
  return [
    '**👋 Chào mừng đến với Quản Gia — Bot Điểm Danh!**',
    '',
    '**🟢 Bắt đầu nhanh (Admin):**',
    '1️⃣ `/setup` — Mở bảng điều khiển',
    '2️⃣ **Cài đặt** → chọn kênh log + timezone',
    '3️⃣ **Thành viên** → thêm người vào hệ thống',
    '4️⃣ **Mở phiên mới** → gửi embed điểm danh vào channel',
    '5️⃣ Thành viên chọn trạng thái từ menu dropdown',
    '',
    '**💡 Mọi thao tác quản trị đều làm trong `/setup`.**',
  ].join('\n');
}

function buildStateline(guild) {
  const lines = [];
  lines.push(`📡 Server: **${guild.name}**`);
  return lines.join(' · ');
}

async function buildEmbed(audience, guild) {
  const items = byAudience(audience);
  const isAdmin = audience === 'admin';

  const groupedByCat = items.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const fields = Object.keys(CATEGORIES)
    .filter(catId => groupedByCat[catId]?.length)
    .map(catId => {
      const cat = CATEGORIES[catId];
      const cmds = groupedByCat[catId];
      const lines = cmds.map(c => {
        const ex = c.examples?.length
          ? `   💡 \`${c.examples[0]}\`${c.examples.length > 1 ? '  ·  …' : ''}`
          : '';
        return `**/${c.name}** — ${c.desc}${ex}`;
      });

      const tips = {
        session: '\n_📌 Dùng `/setup` → Quản lý phiên để xem/đóng nhiều phiên cùng lúc._',
        stats:   '\n_📌 Dùng `/leaderboard` để xem tổng quan cả server._',
        admin:   '\n_📌 Cần quyền **Quản lý Server** để dùng lệnh này._',
        general: '',
      };

      return {
        name: `${cat.emoji} ${cat.label}`,
        value: lines.join('\n') + (tips[catId] ?? ''),
        inline: false,
      };
    });

  const state = guild ? await _getStateLine(guild) : '';

  return new EmbedBuilder()
    .setColor(isAdmin ? COLOR.ADMIN : COLOR.USER)
    .setTitle(isAdmin ? '🛡️ Lệnh cho Admin' : '👤 Lệnh cho mọi người')
    .setDescription([state, isAdmin ? buildQuickStart() : '✅ *Bạn có thể dùng các lệnh này mà không cần quyền admin.*'].filter(Boolean).join('\n'))
    .addFields(...fields)
    .setFooter({ text: `${FOOTER_DEFAULT} · ${items.length} lệnh` })
    .setTimestamp();
}

async function _getStateLine(guild) {
  try {
    const [cfg, sessions] = await Promise.all([
      configService.getGuildConfig(guild.id).catch(() => null),
      sessionService.getActiveSessions(guild.id).catch(() => []),
    ]);
    const parts = [];
    if (cfg?.notification_channel_id) parts.push('✅ Đã cài đặt');
    else parts.push('⚙️ Chưa cài đặt');
    if (sessions.length) parts.push(`🟢 ${sessions.length} phiên đang mở`);
    else parts.push('⚪ Không có phiên nào');
    parts.push(`📡 ${guild.name}`);
    return parts.join(' · ');
  } catch { return `📡 ${guild.name}`; }
}

function buildActionRow(activeAudience) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.USER_PAGE)
      .setLabel('👤 Cho mọi người')
      .setStyle(activeAudience === 'user' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(activeAudience === 'user'),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADMIN_PAGE)
      .setLabel('🛡️ Cho Admin')
      .setStyle(activeAudience === 'admin' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(activeAudience === 'admin'),
  );
}

class HelpCommand extends Command {
  constructor(context) {
    super(context, { name: 'help', description: 'Hiển thị danh sách lệnh + hướng dẫn' });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Hiển thị danh sách lệnh + hướng dẫn'),
    );
  }

  async chatInputRun(interaction) {
    try {
      const embed = await buildEmbed('user', interaction.guild);
      await interaction.reply({ embeds: [embed], components: [buildActionRow('user')], flags: MessageFlags.Ephemeral });
    } catch (e) {
      if (e.code === 40060) { log.warn('HELP', interaction.guildId, 'Stale interaction bỏ qua (40060): %s', interaction.id); return; }
      throw e;
    }
  }

  static async render(audience, target) {
    const embed = await buildEmbed(audience, target.guild);
    return target.update({ embeds: [embed], components: [buildActionRow(audience)] });
  }
}

module.exports = { HelpCommand, CUSTOM_ID };
