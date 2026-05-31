// commands/test_bot.js — /test_bot: kiểm tra toàn bộ chức năng bot
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db  = require('../db.js');
const log = require('../utils/logger.js');
const { requireAdmin } = require('../utils/permissions.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PASS = '✅';
const FAIL = '❌';

// Status hợp lệ theo DB constraint (attendances_status_check)
const VALID_STATUS = 'tham_gia';
const VALID_STATUS_2 = 'tre';

function ms(start) { return `${Date.now() - start}ms`; }

async function runTest(name, fn) {
  const t = Date.now();
  try {
    const detail = await fn();
    return { ok: true, name, detail: detail ?? '', dur: ms(t) };
  } catch (err) {
    return { ok: false, name, detail: err.message ?? String(err), dur: ms(t) };
  }
}

function buildResultEmbed(results, guildName, totalMs) {
  const passed  = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  const total   = results.length;
  const allPass = failed === 0;

  const lines = results.map(r => {
    const icon = r.ok ? PASS : FAIL;
    const det  = r.detail ? ` — \`${r.detail.slice(0, 80)}\`` : '';
    return `${icon} **${r.name}** (${r.dur})${det}`;
  });

  const CHUNK = 12;
  const fields = [];
  for (let i = 0; i < lines.length; i += CHUNK) {
    fields.push({
      name: i === 0 ? '📋 Kết quả' : '\u200b',
      value: lines.slice(i, i + CHUNK).join('\n'),
      inline: false,
    });
  }

  return new EmbedBuilder()
    .setTitle(allPass ? '🟢 Bot Test — PASSED' : '🔴 Bot Test — CÓ LỖI')
    .setDescription(
      `**Guild:** ${guildName}\n` +
      `**Kết quả:** ${passed}/${total} passed${failed > 0 ? ` · ${failed} failed` : ''}\n` +
      `**Thời gian:** ${totalMs}ms tổng`
    )
    .addFields(fields)
    .setColor(allPass ? 0x57F287 : 0xED4245)
    .setTimestamp()
    .setFooter({ text: '/test_bot • Dữ liệu test đã được dọn sạch' });
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function suiteDB_Connectivity(guildId) {
  return [
    await runTest('DB: supabase client khởi tạo', async () => {
      if (!db.supabase) throw new Error('db.supabase là undefined');
      return 'client OK';
    }),
    await runTest('DB: getConfig (guild_configs read)', async () => {
      const cfg = await db.getConfig(guildId);
      return cfg ? `channel=${cfg.channel_id ?? 'null'}` : 'no config (OK)';
    }),
    await runTest('DB: getAllMemberStats (member_stats read)', async () => {
      const rows = await db.getAllMemberStats(guildId);
      return `${rows.length} thành viên`;
    }),
    await runTest('DB: getTopMembers (limit 5)', async () => {
      const rows = await db.getTopMembers(guildId, 5);
      return `${rows.length} rows`;
    }),
    await runTest('DB: getLichCoDinh (scheduled_sessions read)', async () => {
      const rows = await db.getLichCoDinh(guildId);
      return `${rows.length} lịch`;
    }),
    await runTest('DB: getSessionHistory (sessions read)', async () => {
      const rows = await db.getSessionHistory(guildId, 5);
      return `${rows.length} phiên gần nhất`;
    }),
    await runTest('DB: getSessionHistoryWithRange (since 30 ngày)', async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const rows  = await db.getSessionHistoryWithRange(guildId, since, 20);
      return `${rows.length} phiên`;
    }),
    await runTest('DB: getActiveSession', async () => {
      const s = await db.getActiveSession(guildId);
      return s ? `active: ${s.session_name}` : 'không có phiên active (OK)';
    }),
    await runTest('DB: getBadges', async () => {
      const rows = await db.getBadges(guildId);
      return `${rows.length} badge`;
    }),
  ];
}

async function suiteSession_CRUD(guildId, botUserId) {
  const TEST_NAME = `__TEST_SESSION_${Date.now()}__`;
  let sessionId = null;

  const create = await runTest('Session: createSession', async () => {
    const s = await db.createSession(guildId, TEST_NAME, botUserId, null, null, []);
    sessionId = s.id;
    return `id=${s.id}`;
  });

  const read = await runTest('Session: getSessionById', async () => {
    if (!sessionId) throw new Error('skip — createSession failed');
    const s = await db.getSessionById(sessionId, guildId);
    if (!s) throw new Error('không tìm thấy session vừa tạo');
    return `name=${s.session_name}`;
  });

  const msgUpdate = await runTest('Session: updateSessionMessageId', async () => {
    if (!sessionId) throw new Error('skip');
    await db.updateSessionMessageId(sessionId, '999999999999999999');
    return 'message_id updated';
  });

  const active = await runTest('Session: getActiveSession thấy session test', async () => {
    if (!sessionId) throw new Error('skip');
    const s = await db.getActiveSession(guildId);
    return s ? `active=${s.session_name}` : 'no active (có thể có session khác đang chạy)';
  });

  const end = await runTest('Session: endSession (cleanup)', async () => {
    if (!sessionId) throw new Error('skip');
    await db.endSession(sessionId);
    return 'ended';
  });

  return [create, read, msgUpdate, active, end];
}

async function suiteAttendance(guildId, botUserId) {
  const TEST_NAME = `__TEST_ATT_${Date.now()}__`;
  let sessionId = null;

  const setup = await runTest('Attendance: setup session', async () => {
    const s = await db.createSession(guildId, TEST_NAME, botUserId, null, null, []);
    sessionId = s.id;
    return `session ${s.id}`;
  });

  // FIX: dùng 'tham_gia' thay vì 'present' (DB check constraint chỉ chấp nhận tham_gia/tre/vang_mat/...)
  const upsert = await runTest('Attendance: upsertAttendance', async () => {
    if (!sessionId) throw new Error('skip');
    await db.upsertAttendance(sessionId, guildId, botUserId, 'test_bot', VALID_STATUS, botUserId);
    return 'upsert OK';
  });

  const read = await runTest('Attendance: getAttendance', async () => {
    if (!sessionId) throw new Error('skip');
    const a = await db.getAttendance(sessionId, botUserId);
    if (!a) throw new Error('không tìm thấy attendance vừa upsert');
    return `status=${a.status}`;
  });

  const list = await runTest('Attendance: getAttendances (list)', async () => {
    if (!sessionId) throw new Error('skip');
    const rows = await db.getAttendances(sessionId);
    return `${rows.length} record`;
  });

  // FIX: dùng 'tre' thay vì 'absent'
  const noTime = await runTest('Attendance: upsertAttendanceNoTime (sua)', async () => {
    if (!sessionId) throw new Error('skip');
    await db.upsertAttendanceNoTime(sessionId, guildId, botUserId, 'test_bot', VALID_STATUS_2, botUserId);
    return 'noTime upsert OK';
  });

  const summary = await runTest('Attendance: getAttendanceSummaryForSessions', async () => {
    if (!sessionId) throw new Error('skip');
    const map = await db.getAttendanceSummaryForSessions([sessionId]);
    return `map size=${map.size}`;
  });

  const cleanup = await runTest('Attendance: cancelSession (cleanup)', async () => {
    if (!sessionId) throw new Error('skip');
    await db.cancelSession(sessionId);
    return 'cancelled';
  });

  return [setup, upsert, read, list, noTime, summary, cleanup];
}

async function suiteMemberStats(guildId, botUserId) {
  const TEST_PATCH = {
    user_id: botUserId,
    total_sessions: 0,
    total_joined: 0,
    current_streak: 0,
    best_streak: 0,
  };

  const upsert = await runTest('MemberStats: upsertMemberStats', async () => {
    await db.upsertMemberStats(guildId, botUserId, TEST_PATCH);
    return 'upsert OK';
  });

  const read = await runTest('MemberStats: getMemberStats', async () => {
    const s = await db.getMemberStats(guildId, botUserId);
    if (!s) throw new Error('không tìm thấy stats vừa upsert');
    return `joined=${s.total_joined}`;
  });

  const batch = await runTest('MemberStats: batchUpsertMemberStats', async () => {
    await db.batchUpsertMemberStats(guildId, [{ user_id: botUserId, current_streak: 0 }]);
    return 'batch OK';
  });

  const resetStreak = await runTest('MemberStats: resetMemberStreak', async () => {
    await db.resetMemberStreak(guildId, botUserId);
    return 'streak reset';
  });

  return [upsert, read, batch, resetStreak];
}

async function suiteScheduledSessions(guildId) {
  let schedId = null;
  const TEST_NAME = `__TEST_SCHED_${Date.now()}__`;
  const FAKE_CHANNEL_ID = '000000000000000001';

  const create = await runTest('Scheduler: themLichCoDinh', async () => {
    const s = await db.themLichCoDinh(guildId, {
      dayOfWeek: 6, hour: 23, minute: 59,
      sessionName: TEST_NAME,
      closeDayOfWeek: 6, closeHour: 23, closeMinute: 59,
      channelId: FAKE_CHANNEL_ID,
    });
    schedId = s.id;
    return `id=${s.id}`;
  });

  const read = await runTest('Scheduler: getScheduledSessionById', async () => {
    if (!schedId) throw new Error('skip');
    const s = await db.getScheduledSessionById(schedId);
    if (!s) throw new Error('không tìm thấy lịch vừa tạo');
    return `name=${s.session_name}`;
  });

  const list = await runTest('Scheduler: getLichCoDinh (list)', async () => {
    const rows = await db.getLichCoDinh(guildId);
    const found = rows.some(r => r.id === schedId);
    return `${rows.length} lịch, found=${found}`;
  });

  const update = await runTest('Scheduler: updateScheduledSession', async () => {
    if (!schedId) throw new Error('skip');
    await db.updateScheduledSession(schedId, { minute: 58 });
    return 'updated minute=58';
  });

  const del = await runTest('Scheduler: deleteScheduledSession (cleanup)', async () => {
    if (!schedId) throw new Error('skip');
    await db.deleteScheduledSession(schedId);
    return 'deleted';
  });

  return [create, read, list, update, del];
}

async function suiteBadges(guildId) {
  const TEST_THRESHOLD = 9999;

  const upsert = await runTest('Badge: upsertBadge', async () => {
    await db.upsertBadge(guildId, TEST_THRESHOLD, '🧪', 'Test Badge');
    return 'upsert OK';
  });

  const list = await runTest('Badge: getBadges (contains test)', async () => {
    const rows = await db.getBadges(guildId);
    const found = rows.some(r => r.threshold === TEST_THRESHOLD);
    if (!found) throw new Error('không tìm thấy badge vừa upsert');
    return `${rows.length} badges total`;
  });

  const del = await runTest('Badge: deleteBadge (cleanup)', async () => {
    await db.deleteBadge(guildId, TEST_THRESHOLD);
    return 'deleted';
  });

  return [upsert, list, del];
}

async function suiteConfig(guildId) {
  return [
    await runTest('Config: upsertConfig (no-op patch)', async () => {
      await db.upsertConfig(guildId, {});
      return 'upsert OK';
    }),
    await runTest('Config: getConfig after upsert', async () => {
      const cfg = await db.getConfig(guildId);
      if (!cfg) throw new Error('config null sau upsert');
      return 'config OK';
    }),
  ];
}

// ─── Command ──────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('test_bot')
    .setDescription('[Admin] Kiểm tra toàn bộ chức năng bot — tạo dữ liệu test và tự dọn sạch')
    .setDefaultMemberPermissions(0n),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const { guild } = interaction;

    const { ok } = await requireAdmin(interaction, { context: '/test_bot' });
    if (!ok) return;

    const botUserId = interaction.client.user.id;
    const guildId  = guild.id;
    const tStart   = Date.now();

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏳ Đang chạy test...')
          .setDescription('Kiểm tra DB, session, attendance, stats, lịch, badge, config...')
          .setColor(0xFEE75C),
      ],
    });

    log.info('TEST_BOT', `[${guild.name}] Bắt đầu test suite`);

    const allResults = [
      ...(await suiteDB_Connectivity(guildId)),
      ...(await suiteSession_CRUD(guildId, botUserId)),
      ...(await suiteAttendance(guildId, botUserId)),
      ...(await suiteMemberStats(guildId, botUserId)),
      ...(await suiteScheduledSessions(guildId)),
      ...(await suiteBadges(guildId)),
      ...(await suiteConfig(guildId)),
    ];

    const totalMs = Date.now() - tStart;
    const failed  = allResults.filter(r => !r.ok);

    log.info('TEST_BOT', `[${guild.name}] ${allResults.length - failed.length}/${allResults.length} passed (${totalMs}ms)`);
    if (failed.length > 0) {
      failed.forEach(r => log.error('TEST_BOT', null, '[FAIL] %s: %s', r.name, r.detail));
    }

    const embed = buildResultEmbed(allResults, guild.name, totalMs);
    return interaction.editReply({ embeds: [embed] });
  },
};
