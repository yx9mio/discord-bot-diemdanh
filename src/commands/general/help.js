// src/commands/general/help.js
// Hiển thị danh sách lệnh với 2 trang: USER (mặc định) + ADMIN.
// Nút bấm ở footer chuyển trang. Dùng metadata từ utils/commands.js.

'use strict';
const { Command } = require('@sapphire/framework');
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { CATEGORIES, byAudience } = require('../../../utils/commands.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');
const log = require('../../../utils/logger.js');

const CUSTOM_ID = {
  USER_PAGE:  'help:page:user',
  ADMIN_PAGE: 'help:page:admin',
};

const COLOR = {
  USER:  0x57f287,
  ADMIN: 0xfee75c,
  BOTH:  0x01696f,
};

function buildQuickStart() {
  return [
    '**👋 Chào mừng đến với Quản Gia — Bot Điểm Danh!**',
    '',
    '**🟢 Bắt đầu nhanh:**',
    '1️⃣ Admin mở **Bảng điều khiển** với `/setup`',
    '2️⃣ Bấm **Mở phiên mới** → nhập tên → gửi embed điểm danh',
    '3️⃣ Thành viên chọn trạng thái từ menu dropdown trong embed',
    '4️⃣ Admin bấm **⏹️ Đóng phiên** để kết thúc và xem báo cáo',
    '',
    '💡 *Mọi thao tác quản trị (lịch, thành viên, cấu hình) đều làm trong `/setup`.*',
  ].join('\n');
}

function buildEmbed(audience) {
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
          ? `\n   💡 \`${c.examples[0]}\`${c.examples.length > 1 ? '  ·  …' : ''}`
          : '';
        return `**/${c.name}** — ${c.desc}${ex}`;
      });
      return { name: `${cat.emoji} ${cat.label}`, value: lines.join('\n'), inline: false };
    });

  return new EmbedBuilder()
    .setColor(isAdmin ? COLOR.ADMIN : COLOR.USER)
    .setTitle(isAdmin ? '🛡️ Lệnh cho Admin' : '👤 Lệnh cho mọi người')
    .setDescription(
      isAdmin
        ? '🛡️ *Cần quyền **Quản lý Server** (Manage Guild).*\n' + buildQuickStart()
        : '✅ *Bạn có thể dùng các lệnh này mà không cần quyền admin.*',
    )
    .addFields(...fields)
    .setFooter({ text: `${FOOTER_DEFAULT} · ${items.length} lệnh` })
    .setTimestamp();
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
    // [FIX] Guard stale interaction (40060) khi bot restart
    try {
      await interaction.reply({
        embeds: [buildEmbed('user')],
        components: [buildActionRow('user')],
        flags: MessageFlags.Ephemeral,
      });
    } catch (e) {
      if (e.code === 40060) {
        log.warn('HELP', interaction.guildId, 'Stale interaction bỏ qua (40060): %s', interaction.id);
        return;
      }
      throw e;
    }
  }

  // Public — gọi từ interaction handler
  static render(audience, target) {
    return target.update({
      embeds: [buildEmbed(audience)],
      components: [buildActionRow(audience)],
    });
  }
}

module.exports = { HelpCommand, CUSTOM_ID };
