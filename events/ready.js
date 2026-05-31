// events/ready.js
// Phase 11.2: khoiPhucHenGio dùng getAllActiveSessions() — 1 query thay vì N
// L-3: startHealthServer() — HTTP health endpoint cho Railway/UptimeRobot
const { REST, Routes, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs   = require('fs');
const db   = require('../db.js');
const log  = require('../utils/logger.js');
const { datHenGioDong }    = require('../utils/timers.js');
const { ketThucPhien, thongBaoHuyHieu, voHieuHoaNutDiemDanh } = require('../utils/session.js');
const { buildSummaryEmbed, FOOTER_DEFAULT } = require('../utils/embeds.js');
const { khoiPhucScheduler } = require('../utils/scheduler.js');
const { startHealthServer } = require('./healthServer.js');

let dangKhoiPhuc = false;

async function dangKyCommands(client) {
  const dir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const commandData = files.map(f => require(path.join(dir, f)).data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    log.info('SYSTEM', null, 'Đã xóa global commands cũ.');
  } catch (err) {
    log.warn('SYSTEM', null, 'Không xóa được global commands: %s', err.message);
  }

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
  log.info('SYSTEM', null, 'Đã đăng ký %s lệnh cho %s guild(s)', commandData.length, guildOk);
}

async function khoiPhucHenGio(client) {
  if (dangKhoiPhuc) return;
  dangKhoiPhuc = true;
  try {
    const sessions = await db.getAllActiveSessions();
    if (sessions.length === 0) {
      log.info('SYSTEM', null, 'Không có phiên nào cần khôi phục hẹn giờ.');
      return;
    }

    log.info('SYSTEM', null, 'Khôi phục hẹn giờ cho %s phiên đang mở...', sessions.length);

    for (const session of sessions) {
      const guildId   = session.guild_id;
      const channelId = session.channel_id;
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          log.warn('SYSTEM', guildId, 'Guild không có trong cache — bỏ qua phiên %s', session.id);
          continue;
        }
        if (!session.auto_close_at) continue;
        if (!channelId) continue;

        const ms = new Date(session.auto_close_at).getTime() - Date.now();
        if (ms > 0) {
          await datHenGioDong(client, guild, session, channelId, ms);
          log.info('SYSTEM', guildId, 'Khôi phục hẹn giờ: %s — %s (còn %ss)', guild.name, session.session_name, Math.round(ms / 1000));
        } else {
          const ch = await guild.channels.fetch(channelId).catch(() => null);
          if (!ch) {
            log.warn('SYSTEM', guildId, 'Channel %s không tìm thấy — endSession thầm lặng', channelId);
            await db.endSession(session.id);
            continue;
          }
          const attended = await db.getAttendances(session.id);
          const statsMap = await ketThucPhien(guild, session, attended);
          await voHieuHoaNutDiemDanh(client, ch, session);
          const thongBao = new EmbedBuilder()
            .setColor(0x99AAB5)
            .setDescription('🔒 Phiên điểm danh đã tự động kết thúc trong lúc bot offline.')
            .setFooter({ text: FOOTER_DEFAULT });
          await ch.send({ embeds: [thongBao, buildSummaryEmbed(session, attended)] });
          await thongBaoHuyHieu(guild, ch, guildId, session.id, attended, statsMap);
          log.info('SYSTEM', guildId, 'Đóng phiên offline: %s — %s', guild.name, session.session_name);
        }
      } catch (e) {
        log.error('SYSTEM', guildId, 'Lỗi khôi phục phiên %s: %s', session.id, e.message);
      }
    }
  } finally {
    dangKhoiPhuc = false;
  }
}

async function onReady(client) {
  log.info('SYSTEM', null, 'Đã sẵn sàng: %s', client.user.tag);
  startHealthServer(client);   // L-3: HTTP health :PORT
  await dangKyCommands(client);
  await khoiPhucHenGio(client);
  await khoiPhucScheduler(client);
}

module.exports = { onReady };
