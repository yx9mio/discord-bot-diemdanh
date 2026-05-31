// events/ready.js
const { REST, Routes, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs   = require('fs');
const db   = require('../db.js');
const log  = require('../utils/logger.js');
const { datHenGioDong }    = require('../utils/timers.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { buildSummaryEmbed, FOOTER_DEFAULT } = require('../utils/embeds.js');
const { khoiPhucScheduler } = require('../utils/scheduler.js');

let dangKhoiPhuc = false;

async function dangKyCommands(client) {
  const dir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const commandData = files.map(f => require(path.join(dir, f)).data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  // ── Xóa global commands (nếu còn tồn tại từ trước) để tránh trùng lặp ──
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    log.info('SYSTEM', null, 'Đã xóa global commands cũ.');
  } catch (err) {
    log.warn('SYSTEM', null, 'Không xóa được global commands: %s', err.message);
  }

  // ── Guild-specific: hiện ngay lập tức cho mọi guild bot đang ở ──────────
  const guilds = client.guilds.cache.values();
  let guildOk = 0;
  for (const guild of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commandData }
      );
      guildOk++;
    } catch (err) {
      log.error('SYSTEM', guild.id, 'Lỗi đăng ký commands: %s', err.message);
    }
  }
  log.info('SYSTEM', null, 'Đã đăng ký %s lệnh cho %s guild(s) — guild-only, hiện ngay lập tức.', commandData.length, guildOk);
}

async function khoiPhucHenGio(client) {
  if (dangKhoiPhuc) return;
  dangKhoiPhuc = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      try {
        const session = await db.getActiveSession(guild.id);
        if (!session || !session.auto_close_at) continue;
        const channelId = session.channel_id;
        if (!channelId) continue;
        const ms = new Date(session.auto_close_at).getTime() - Date.now();
        if (ms > 0) {
          await datHenGioDong(client, guild, session, channelId, ms);
          log.info('SYSTEM', guild.id, 'Khôi phục hẹn giờ: %s — %s', guild.name, session.session_name);
        } else {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (!ch) continue;
          const attended = await db.getAttendances(session.id);
          const statsMap = await ketThucPhien(guild, session, attended);
          await voHieuHoaNutDiemDanh(client, ch, session);
          const thongBao = new EmbedBuilder()
            .setColor(0x99AAB5)
            .setDescription('🔒 Phiên điểm danh đã tự động kết thúc trong lúc bot offline.')
            .setFooter({ text: FOOTER_DEFAULT });
          await ch.send({ embeds: [thongBao, buildSummaryEmbed(session, attended)] });
          await thongBaoHuyHieu(guild, ch, guild.id, session.id, attended, statsMap);
          log.info('SYSTEM', guild.id, 'Đóng phiên offline: %s — %s', guild.name, session.session_name);
        }
      } catch (e) {
        log.error('SYSTEM', guild.id, 'Lỗi khôi phục guild: %s', e.message);
      }
    }
  } finally {
    dangKhoiPhuc = false;
  }
}

async function onReady(client) {
  log.info('SYSTEM', null, 'Đã sẵn sàng: %s', client.user.tag);
  await dangKyCommands(client);
  await khoiPhucHenGio(client);
  await khoiPhucScheduler(client);  // Khôi phục lịch cố định
}

module.exports = { onReady };
