// events/ready.js
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs   = require('fs');
const db   = require('../db.js');
const { datHenGioDong } = require('../utils/timers.js');

async function dangKyCommands(client) {
  const dir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const commandData = files.map(f => require(path.join(dir, f)).data.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
    console.log(`[Quản Gia] Đã đăng ký ${commandData.length} lệnh thành công.`);
  } catch (err) {
    console.error('[Quản Gia] Lỗi đăng ký lệnh:', err);
  }
}

async function khoiPhucHenGio(client) {
  let dangKhoiPhuc = false;
  if (dangKhoiPhuc) return;
  dangKhoiPhuc = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      try {
        const session = await db.getActiveSession(guild.id);
        if (!session || !session.auto_close_at) continue;

        const ms = new Date(session.auto_close_at).getTime() - Date.now();
        const channelId = session.channel_id;
        if (!channelId) continue;

        if (ms > 0) {
          await datHenGioDong(client, guild, session, channelId, ms);
          console.log(`[Quản Gia] Khôi phục hẹn giờ: ${guild.name} — ${session.session_name}`);
        } else {
          // Hết giờ trong lúc bot offline — tự đóng ngay
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (!ch) continue;
          const attended = await db.getAttendances(session.id);
          const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
          const { buildSummaryEmbed, FOOTER_DEFAULT } = require('../utils/embeds.js');
          const { EmbedBuilder } = require('discord.js');
          await ketThucPhien(guild, session, attended);
          await voHieuHoaNutDiemDanh(client, ch, session);
          const thongBao = new EmbedBuilder()
            .setColor(0x99AAB5)
            .setDescription('🔒 Phiên điểm danh đã tự động kết thúc trong lúc bot offline.')
            .setFooter({ text: FOOTER_DEFAULT });
          await ch.send({ embeds: [thongBao, buildSummaryEmbed(session, attended)] });
          await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended);
          console.log(`[Quản Gia] Đóng phiên offline: ${guild.name} — ${session.session_name}`);
        }
      } catch (e) {
        console.error(`[Quản Gia] Lỗi khôi phục guild ${guild.id}:`, e.message);
      }
    }
  } finally {
    dangKhoiPhuc = false;
  }
}

async function onReady(client) {
  console.log(`[Quản Gia] Đã sẵn sàng: ${client.user.tag}`);
  await dangKyCommands(client);
  await khoiPhucHenGio(client);
}

module.exports = { onReady };
