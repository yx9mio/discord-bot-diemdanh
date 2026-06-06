// src/commands/general/help.js
// Hiển thị danh sách lệnh với 2 trang: USER (mặc định) + ADMIN.
'use strict';
const { Command } = require('@sapphire/framework');
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { CATEGORIES, byAudience } = require('../../../utils/commands.js');
const { FOOTER_DEFAULT } = require('../../../utils/embeds.js');

const CUSTOM_ID = {
  USER_PAGE:  'help:page:user',
  ADMIN_PAGE: 'help:page:admin',
};

const COLOR = {
  USER:  0x57f287,
  ADMIN: 0xfee75c,
};

function buildQuickStartUser() {
  return [
    '> Đây là **Quản Gia — Bot Điểm Danh**. Dưới đây là các thác tác bạn có thể làm khi có phiên đang mở.',
    '',
    '**\uD83D\uDFE2 Cách điểm danh:**',
    '1\uFE0F\u20E3 Vào kênh điểm danh khi có embed phiên mới',
    '2\uFE0F\u20E3 Chọn trạng thái từ menu **\uD83D\uDC46 Chọn trạng thái điểm danh...**',
    '   ✅ Tham gia \u00b7 \uD83D\uDD52 Trễ \u00b7 \uD83D\uDDD2\uFE0F Có phép \u00b7 \u274C Vắng',
    '3\uFE0F\u20E3 Bot gửi xác nhận riêng tư cho bạn',
    '',
    '\uD83D\uDC40 Nhấn **Xem danh sách** để kiểm tra ai đã điểm danh.',
  ].join('\n');
}

function buildQuickStartAdmin() {
  return [
    '> Hướng dẫn nhanh dành cho **Admin / Quản lý server**.',
    '',
    '**\uD83D\uDE80 Bắt đầu:**',
    '1\uFE0F\u20E3 Gõ `/setup` → Bảng điều khiển xuất hiện',
    '2\uFE0F\u20E3 Nhấn **\u2699\uFE0F Cài đặt** → chọn kênh log, vai trò Phái, timezone',
    '3\uFE0F\u20E3 Nhấn **\uD83D\uDC65 Thành viên** → thêm người vào danh sách eligible',
    '4\uFE0F\u20E3 Nhấn **\uD83D\uDCC5 Lịch cố định** → thiết lập giờ tự động mở phiên hàng tuần',
    '5\uFE0F\u20E3 Nhấn **\u2795 Mở phiên mới** → nhập tên phiên, thời gian → bot gửi embed',
    '6\uFE0F\u20E3 Nhấn **\uD83D\uDD12 Đóng phiên** trong embed → bot gửi tổng kết + CSV',
    '',
    '\uD83D\uDCA1 *Mọi thao tác quản trị đều nằm trong `/setup` — không cần nhớ lệnh phụ.*',
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
          ? `\n   \uD83D\uDCA1 \`${c.examples[0]}\`` : '';
        // Slash command dùng backtick, UI button dùng bullet bình thường
        const isSlash = c.name === c.name.toLowerCase() && !c.name.includes(' ');
        const nameStr = isSlash ? `**\`/${c.name}\`**` : `**${c.name}**`;
        return `${nameStr} \u2014 ${c.desc}${ex}`;
      });
      return { name: `${cat.emoji} ${cat.label}`, value: lines.join('\n'), inline: false };
    });

  return new EmbedBuilder()
    .setColor(isAdmin ? COLOR.ADMIN : COLOR.USER)
    .setTitle(isAdmin ? '\uD83D\uDEE1\uFE0F Lệnh cho Admin' : '\uD83D\uDC64 Lệnh cho mọi người')
    .setDescription(isAdmin ? buildQuickStartAdmin() : buildQuickStartUser())
    .addFields(...fields)
    .setFooter({ text: `${FOOTER_DEFAULT} \u00b7 ${items.length} mục` })
    .setTimestamp();
}

function buildActionRow(activeAudience) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.USER_PAGE)
      .setLabel('\uD83D\uDC64 Cho mọi người')
      .setStyle(activeAudience === 'user' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(activeAudience === 'user'),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.ADMIN_PAGE)
      .setLabel('\uD83D\uDEE1\uFE0F Cho Admin')
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
    await interaction.reply({
      embeds: [buildEmbed('user')],
      components: [buildActionRow('user')],
      flags: MessageFlags.Ephemeral,
    });
  }

  static render(audience, target) {
    return target.update({
      embeds: [buildEmbed(audience)],
      components: [buildActionRow(audience)],
    });
  }
}

module.exports = { HelpCommand, CUSTOM_ID };
