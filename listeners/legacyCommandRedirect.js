// listeners/legacyCommandRedirect.js
// Q10=a: Khi user dùng lệnh slash cũ (đã bị xoá ở Commit 6) → reply ephemeral
// "Lệnh đã chuyển vào /setup" + ngăn command cũ chạy.
//
// Lưu ý: Discord cache slash command ~1 giờ. Listener này là safety net
// cho user click vào lệnh cũ trong cache. Sau khi cache refresh, lệnh cũ
// biến mất hoàn toàn.
'use strict';
const { Listener, Events } = require('@sapphire/framework');

// Các tên slash command đã bị xoá ở Commit 6 (Q1=b: chỉ giữ 6 commands)
const LEGACY_COMMANDS = new Set([
  // Cài đặt (thay bằng /setup → Cài đặt chung)
  'caidat', 'caidatphai', 'nhacnho', 'lichcodinh', 'log', 'quanly',
  // Thành viên
  'them', 'sua', 'xoa', 'xem', 'member', 'resetstreak',
  // Phiên
  'huy', 'quanlyphien', 'broadcast',
  // Thống kê
  'thongke_server', 'thongkephien', 'xuat',
  // Cá nhân (cũ)
  'toi', 'xem_diemdanh', 'thong_ke', 'rank', 'lichsu',
]);

// (REDIRECT_MESSAGE đã inline trong run() để chèn commandName)

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
        ephemeral: true,
      });
    } catch (_e) {
      // Đã reply hoặc token expired — bỏ qua
    }
  }
}

module.exports = { LegacyCommandRedirectListener, LEGACY_COMMANDS };
