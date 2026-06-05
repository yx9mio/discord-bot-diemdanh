// src/utils/embeds.js
// Tiện ích tạo embed Discord dùng chung
'use strict';

const FOOTER_DEFAULT = 'Bot Điểm Danh';

/**
 * Tạo progress bar dạng text
 * @param {number} pct  - Phần trăm (0-100)
 * @param {number} len  - Độ dài bar (default 10)
 * @returns {string}
 */
function buildRichProgressBar(pct = 0, len = 10) {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * len);
  const empty  = len - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Trả về emoji tương ứng với % tham gia
 * @param {number} pct
 * @returns {string}
 */
function pctEmoji(pct = 0) {
  if (pct >= 90) return '🌟';
  if (pct >= 75) return '✅';
  if (pct >= 50) return '🟡';
  if (pct >= 25) return '🟠';
  return '🔴';
}

/**
 * Trả về nhãn văn bản tương ứng với % tham gia
 * @param {number} pct
 * @returns {string}
 */
function pctLabel(pct = 0) {
  if (pct >= 90) return 'Xuất sắc';
  if (pct >= 75) return 'Tốt';
  if (pct >= 50) return 'Trung bình';
  if (pct >= 25) return 'Yếu';
  return 'Kém';
}

module.exports = { FOOTER_DEFAULT, buildRichProgressBar, pctEmoji, pctLabel };
