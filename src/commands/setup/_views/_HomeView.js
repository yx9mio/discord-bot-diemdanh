'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, ICONS, getPhaiIcon } = require('../../../../utils/theme.js');
const { FOOTER_DEFAULT, buildAuthor, buildRichProgressBar } = require('../../../../utils/embeds.js');
const { DAY_NAMES: DAY_VI } = require('../../../../utils/format.js');

const CUSTOM_ID = {
  HOME:      'setup:home',
  CFG:       'setup:cfg',
  SCH:       'setup:sch',
  MEM:       'setup:mem',
  SESSION:   'setup:session',
  START:     'setup:session:start',
  REFRESH:   'setup:home:refresh',
  BROADCAST: 'setup:session:broadcast',
  STATS:     'setup:stats',
  AUDIT:     'setup:audit',
};

// ─── Trạng thái Dashboard ─────────────────────────────────────────────
// active: có Kỳ đang mở · incomplete: thiếu cấu hình · empty: chưa có lịch
// ready: sẵn sàng mở Kỳ · error: không tải được dữ liệu (renderError riêng)
const REQUIRED_CONFIG = [
  { key: 'notification_channel_id', label: 'Chọn kênh thông báo' },
  { key: 'admin_role_id', label: 'Cấu hình role quản trị' },
  { key: 'attendance_role_id', label: 'Thêm role đối tượng điểm danh' },
];

// [REDESIGN] "Thêm thành viên" là mục phụ (tuỳ chọn) — không nằm trong checklist bắt buộc
const CHECKLIST_ITEMS = [...REQUIRED_CONFIG.map(c => c.label), 'Cấu hình phái'];
const CHECKLIST_TOTAL = CHECKLIST_ITEMS.length;

function _computeState(cfg, members, schedules, sessions) {
  if ((sessions?.length ?? 0) > 0) return { state: 'active', missing: [] };
  const missing = [];
  for (const { key, label } of REQUIRED_CONFIG) {
    if (!cfg?.[key]) missing.push(label);
  }
  if (!(cfg?.phai_role_ids?.length)) missing.push('Cấu hình phái');
  if (missing.length) return { state: 'incomplete', missing };
  if ((schedules?.length ?? 0) === 0) return { state: 'empty', missing };
  return { state: 'ready', missing };
}

// ─── Time helpers (theo timezone cấu hình) ────────────────────────────
function _tzOffset(tz, atMs) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const map = {};
  for (const p of f.formatToParts(new Date(atMs))) map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return Math.round((asUTC - atMs) / 60000);
}

function _tzNow(tz, nowMs) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  });
  const map = {};
  for (const p of f.formatToParts(new Date(nowMs))) map[p.type] = p.value;
  return {
    year: +map.year, month: +map.month, day: +map.day,
    hour: +map.hour, minute: +map.minute,
    dow: new Date(Date.UTC(+map.year, +map.month - 1, +map.day)).getUTCDay(),
  };
}

function _wallClockMs(tz, y, m, d, h, min) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  return guess - _tzOffset(tz, guess) * 60000;
}

function _nextDow(dow, h, min, tz, nowMs) {
  const now = _tzNow(tz, nowMs);
  let ahead = (dow - now.dow + 7) % 7;
  if (ahead === 0 && now.hour * 60 + now.minute >= h * 60 + min) ahead = 7;
  return _wallClockMs(tz, now.year, now.month, now.day + ahead, h, min);
}

/**
 * Tìm lịch mở tiếp theo gần nhất (recurring theo day_of_week, one_time theo
 * scheduled_date). Trả về { schedule, at } hoặc null.
 */
function _nextSchedule(schedules, tz, nowMs = Date.now()) {
  if (!Array.isArray(schedules) || !schedules.length) return null;
  let best = null;
  for (const s of schedules) {
    const h = s.hour ?? 0, min = s.minute ?? 0;
    let at = null;
    if (s.scheduled_date || s.type === 'one_time') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.scheduled_date ?? '');
      if (m) at = _wallClockMs(tz, +m[1], +m[2], +m[3], h, min);
    } else if (s.day_of_week != null) {
      at = _nextDow(s.day_of_week, h, min, tz, nowMs);
    }
    if (at == null || at < nowMs) continue;
    if (!best || at < best.at) best = { schedule: s, at };
  }
  return best;
}

// ─── Render ───────────────────────────────────────────────────────────
function _fmtSchedule(s) {
  const isOneTime = s.type === 'one_time' || s.scheduled_date;
  const day  = isOneTime ? (s.scheduled_date ?? '?') : (DAY_VI[s.day_of_week] ?? '?');
  const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
  const remind = s.reminder_1_min != null ? ` ⏱️ ${s.reminder_1_min}p` : '';
  return `**${day} ${time}** — ${s.session_name ?? 'Bang Chiến'}${remind}`;
}

function render({ guild, cfg, schedules, members, sessions, attendances }) {
  const activeSessions = sessions ?? [];
  const cnt = activeSessions.length;
  const tz  = cfg?.timezone ?? 'Asia/Ho_Chi_Minh';
  const hasChannel = !!cfg?.notification_channel_id;
  const { state, missing } = _computeState(cfg, members, schedules, activeSessions);

  const desc = [];

  if (state === 'active') {
    desc.push('> 🟢 **Hệ thống sẵn sàng** — đang có Bang Chiến hoạt động.');
  } else if (state === 'incomplete') {
    const doneCount = CHECKLIST_TOTAL - missing.length;
    desc.push('> ⚠️ **Server chưa sẵn sàng**');
    desc.push(`> 📋 **${doneCount}/${CHECKLIST_TOTAL} mục đã hoàn tất**`);
    desc.push(`> \`${buildRichProgressBar((doneCount / CHECKLIST_TOTAL) * 100, 8)}\``);
    for (const label of CHECKLIST_ITEMS) {
      desc.push(`${missing.includes(label) ? '⬜' : '✅'} ${label}`);
    }
    desc.push('> _Hãy hoàn tất các mục trên trước khi mở Bang Chiến._');
  } else if (state === 'empty') {
    desc.push('> 💤 **Chưa có dữ liệu** — cấu hình đã đủ, hãy thêm lịch và bắt đầu.');
  } else {
    desc.push('> 🟢 **Hệ thống sẵn sàng** — bấm **➕ Mở Bang Chiến** bên dưới.');
  }

  if (cnt > 0) {
    const s = activeSessions[0];
    const name = s.session_name ?? 'Bang Chiến';
    const extras = cnt > 1 ? ` (+${cnt - 1} Kỳ khác)` : '';
    const autoClose = s.auto_close_at
      ? `<t:${Math.floor(new Date(s.auto_close_at).getTime() / 1000)}:R>`
      : 'theo lịch';
    desc.push(`\n⚔️ **Bang Chiến hiện tại**\n🟢 **${name}**${extras}\n⏱️ Tự đóng: ${autoClose}`);

    const atts = attendances ?? [];
    // [FIX] Quân số = thành viên đã thêm (qua "Thêm thành viên"), nhất quán với SessionView;
    // trước đây dùng eligible_member_ids (luôn rỗng) nên luôn hiện X/0 · 0%
    const eligible = members?.length ?? 0;
    const totalPresent = atts.filter(a => a.status === 'tham_gia' || a.status === 'tre').length;
    const pct = eligible > 0 ? Math.round((totalPresent / eligible) * 100) : 0;
    desc.push(`👥 Quân số: **${totalPresent}/${eligible}** · **${pct}%**`);

    const phaiIds = cfg?.phai_role_ids ?? [];
    if (phaiIds.length && members?.length) {
      const attMap = {};
      for (const a of atts) attMap[a.user_id] = a.status;
      const lines = phaiIds.map(rid => {
        const membersIn = members.filter(m => (m.phai_role_ids ?? []).includes(rid));
        const total = membersIn.length;
        if (!total) return null;
        const attended = membersIn.filter(m =>
          attMap[m.user_id] && ['tham_gia', 'tre'].includes(attMap[m.user_id])
        ).length;
        const icon = getPhaiIcon(rid, phaiIds, guild, cfg?.phai_role_icons);
        const role = guild?.roles?.cache?.get(rid);
        return `${icon} ${role?.name ?? rid}: **${attended}**`;
      }).filter(Boolean);
      if (lines.length) desc.push(`⚔️ **Phân bố Phái**\n${lines.join('\n')}`);
    }
  }

  const next = _nextSchedule(schedules, tz);
  if (next) {
    const s = next.schedule;
    const isOneTime = s.type === 'one_time' || s.scheduled_date;
    const day = isOneTime ? (s.scheduled_date ?? '?') : (DAY_VI[s.day_of_week] ?? '?');
    const time = `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}`;
    desc.push(`\n📅 **Kế tiếp**\n**${day} · ${time}** — ${s.session_name ?? 'Bang Chiến'}\n_${ICONS.CALENDAR} Lịch đang bật: ${(schedules ?? []).length}_`);
  } else if (state !== 'incomplete') {
    desc.push(`\n📅 _Chưa có lịch — bấm **📅 Lịch** để thêm._`);
  }

  const color = state === 'incomplete' ? COLORS.WARNING
    : state === 'empty' ? COLORS.NEUTRAL
    : COLORS.SUCCESS;

  // [REDESIGN] Cấu hình tách thành fields inline — không còn lẫn vào desc
  const configFields = [
    { name: '📡 Kênh thông báo', value: hasChannel ? `<#${cfg.notification_channel_id}>` : '🔴 Chưa cài', inline: true },
    { name: '🌐 Múi giờ', value: `\`${tz}\``, inline: true },
    { name: `${ICONS.MEMBER} Quân số`, value: `**${members?.length ?? 0}**`, inline: true },
  ];

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor(buildAuthor(guild))
    .setTitle('⚙️ Cài Đặt Bot')
    .setThumbnail(guild.iconURL({ size: 64 }) ?? null)
    .setDescription(desc.join('\n'))
    .addFields(...configFields)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const primaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.SESSION).setLabel('Bang Chiến').setEmoji(ICONS.SWORD).setStyle(cnt > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.STATS).setLabel('BXH').setEmoji(ICONS.TROPHY).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.AUDIT).setLabel('Nhật ký').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.CFG).setLabel('Cài Đặt').setEmoji(ICONS.GEAR).setStyle(hasChannel ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.MEM).setLabel('Quân Số').setEmoji(ICONS.MEMBER).setStyle(ButtonStyle.Secondary),
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.START).setLabel('Mở Bang Chiến').setEmoji(ICONS.PLUS).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.SCH).setLabel('Lịch').setEmoji(ICONS.CALENDAR).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.BROADCAST).setLabel('Phát Tin').setEmoji(ICONS.BELL).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Làm Mới').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [primaryRow, actionRow] };
}

function renderError({ guild, reason }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setAuthor(buildAuthor(guild))
    .setTitle('❌ Không thể tải Dashboard')
    .setDescription(`Nguyên nhân: ${reason ?? 'không truy cập được dữ liệu cấu hình.'}`)
    .setFooter({ text: FOOTER_DEFAULT })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CUSTOM_ID.REFRESH).setLabel('Thử lại').setEmoji(ICONS.REFRESH).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CUSTOM_ID.HOME).setLabel('Cài Đặt Bot').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  HomeView: { render, renderError, CUSTOM_ID, _computeState, _nextSchedule },
};