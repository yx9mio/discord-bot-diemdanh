'use strict';
const pino = require('pino');

const IS_DEV = process.env.NODE_ENV !== 'production';

const transport = IS_DEV
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
  : { target: 'pino/file', options: { destination: 1 }, level: process.env.LOG_LEVEL ?? 'info' };

const _root = pino({ level: process.env.LOG_LEVEL ?? (IS_DEV ? 'debug' : 'info') }, pino.transport(transport));

function child(module, guildId) {
  return _root.child({ module, guildId: guildId ?? undefined });
}

const _compat = {
  info:  (mod, gId, ...a) => child(mod, gId).info(...a),
  warn:  (mod, gId, ...a) => child(mod, gId).warn(...a),
  error: (mod, gId, ...a) => child(mod, gId).error(...a),
  debug: (mod, gId, ...a) => child(mod, gId).debug(...a),
};

module.exports = Object.assign(_compat, { root: _root, child });
