// utils/logger.js — Structured logger cho Quản Gia
// Usage:
//   const log = require('./utils/logger.js');
//   log.info('SCHEDULER', guildId, 'Đã mở phiên "%s"', session_name);
//   log.warn('READY',     null,    'Không xóa được commands: %s', err.message);
//   log.error('CMD',      guildId, 'Lỗi lệnh /batdau: %s', err.stack);

const ANSI = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  // levels
  info:   '\x1b[36m',   // cyan
  warn:   '\x1b[33m',   // yellow
  error:  '\x1b[31m',   // red
  debug:  '\x1b[35m',   // magenta
  // accents
  guild:  '\x1b[32m',   // green
  tag:    '\x1b[34m',   // blue
};

function timestamp() {
  return new Date().toLocaleTimeString('vi-VN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function buildLine(level, tag, guildId, msg) {
  const ts  = `${ANSI.dim}[${timestamp()}]${ANSI.reset}`;
  const lv  = `${ANSI[level] ?? ''}${ANSI.bold}[${level.toUpperCase().padEnd(5)}]${ANSI.reset}`;
  const tg  = `${ANSI.tag}[${tag}]${ANSI.reset}`;
  const gld = guildId ? `${ANSI.guild}[${guildId}]${ANSI.reset} ` : '';
  return `${ts} ${lv} ${tg} ${gld}${msg}`;
}

function log(level, tag, guildId, ...args) {
  // Hỗ trợ format string đơn giản với %s
  let msg;
  if (args.length === 0) {
    msg = '';
  } else if (args.length === 1) {
    msg = String(args[0] ?? '');
  } else if (typeof args[0] === 'string' && args[0].includes('%s')) {
    let i = 1;
    msg = args[0].replace(/%s/g, () => String(args[i++] ?? ''));
  } else {
    msg = args.map(a => (a instanceof Error ? a.stack ?? a.message : String(a ?? ''))).join(' ');
  }

  const line = buildLine(level, tag, guildId, msg);
  if (level === 'error') process.stderr.write(line + '\n');
  else                   process.stdout.write(line + '\n');
}

module.exports = {
  info:  (tag, guildId, ...args) => log('info',  tag, guildId, ...args),
  warn:  (tag, guildId, ...args) => log('warn',  tag, guildId, ...args),
  error: (tag, guildId, ...args) => log('error', tag, guildId, ...args),
  debug: (tag, guildId, ...args) => log('debug', tag, guildId, ...args),
};
