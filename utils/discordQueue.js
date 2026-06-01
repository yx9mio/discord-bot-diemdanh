// utils/discordQueue.js — Rate-limit Discord API calls
// p-queue là ESM-only package — dùng dynamic import() để tương thích CJS
'use strict';
const log = require('./logger.js');

/** @type {import('p-queue').default | null} */
let _queue = null;

/** Khởi tạo queue lười (lazy) và cache lại. */
async function getQueue() {
  if (_queue) return _queue;
  // dynamic import ESM module từ CJS — đây là cách duy nhất hợp lệ
  const { default: PQueue } = await import('p-queue');
  _queue = new PQueue({
    concurrency: 5,    // tối đa 5 task chạy song song
    intervalCap: 5,    // tối đa 5 task / interval
    interval:    1000, // interval 1 giây — khớp với Discord global rate-limit
  });
  _queue.on('error', (err) => {
    log.error('DISCORD_QUEUE', null, 'Queue task error: %s', err.message);
  });
  return _queue;
}

/**
 * Đưa một Discord API call vào queue.
 * Sử dụng thay cho channel.send() / message.edit() trực tiếp
 * khi có nhiều call đồng thời (ví dụ: đóng phiên + gửi CSV + gửi badge).
 *
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function enqueue(fn) {
  const q = await getQueue();
  return q.add(fn);
}

/**
 * Trả về số task đang chờ — hữơu ích để debug / health check.
 * @returns {Promise<number>}
 */
async function pendingCount() {
  const q = await getQueue();
  return q.size;
}

module.exports = { enqueue, pendingCount };
