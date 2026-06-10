// listeners/legacyCommandRedirect.js
// Q10=a: Khi user dùng lệnh slash cũ (đã bị xoá ở Commit 6) → reply ephemeral
// "Lệnh đã chuyển vào /setup" + ngăn command cũ chạy.
'use strict';
const { MessageFlags } = require('discord.js');
const { Listener, Events } = require('@sapphire/framework');

const LEGACY_COMMANDS = new Set([
  'caidat', 'caidatphai', 'nhacnho', 'lichcodinh', 'log', 'quanly',
  'them', 'sua', 'xoa', 'xem', 'member', 'resetstreak',
  'huy', 'quanlyphien', 'broadcast',
  'thongke_server', 'thongkephien', 'xuat',
  'toi', 'xem_diemdanh', 'thong_ke', 'rank', 'lichsu',
]);

class LegacyCommandRedirectListener extends Listener {
  constructor(context) {
    super(context, { event: Events.InteractionCreate, name: 'legacyCommandRedirect' });
  }

  async run(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!LEGACY_COMMANDS.has(interaction.commandName)) return;
    if (interaction.replied || interaction.deferred) return;
    try {
      await interaction.reply({
        content: `🚚 Lệnh \`/${interaction.commandName}\` đã được gộp vào \`/setup\` (Bảng điều khiển).`
          + `\n> Bấm \`/setup\` để truy cập lịch, thành viên, phiên, cài đặt.`
          + `\n> _Lệnh cũ sẽ tự biến mất sau khi Discord refresh cache (khoảng 1 giờ)._`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (_e) {
      // Đã reply hoặc token expired — bỏ qua
    }
  }
}

module.exports = { LegacyCommandRedirectListener, LEGACY_COMMANDS };
