// utils/discordQueue.js — Rate-limit Discord API calls bằng p-queue
// Ngăn bot bị 429 khi gửi nhiều message/edit cùng lúc
'use strict';

// p-queue là ESM-only → dùng dynamic import một lần rồi cache
let _queue = null;

async function getQueue() {
  if (_queue) return _queue;
  const { default: PQueue } = await import('p-queue');
  _queue = new PQueue({
    concurrency:  5,   // tối đa 5 task chạy đồng thời
    intervalCap:  5,   // tối đa 5 task mỗi interval
    interval:     1000, // interval = 1 giây
  });
  _queue.on('error', err => {
    const log = require('./logger.js');
    log.error('DISCORD_QUEUE', null, 'Queue error: %s', err.message);
  });
  return _queue;
}

/**
 * Enqueue một Discord API call vào rate-limit queue.
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function enqueue(fn) {
  const q = await getQueue();
  return q.add(fn);
}

module.exports = { enqueue };
