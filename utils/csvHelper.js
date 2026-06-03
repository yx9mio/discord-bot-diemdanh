// utils/csvHelper.js — CSV export an toàn dùng csv-stringify (RFC 4180)
// Thay thế cho string concat thủ công trong guiCsvDinhKem
'use strict';
const { stringify } = require('csv-stringify/sync');

/**
 * Chuyển mảng attendance records thành CSV Buffer.
 * Tự động escape dấu phẩy, ngoặc kép, xuống dòng trong giá trị.
 *
 * @param {Array<{ user_id, username, status, checked_in_at }>} records
 * @returns {Buffer}
 */
function buildCsvBuffer(records) {
  const rows = records.map(r => ({
    user_id:  r.user_id,
    username: r.username ?? '',
    status:   r.status   ?? '',
    time:     r.checked_in_at ?? '',
  }));

  const csv = stringify(rows, {
    header:  true,
    columns: [
      { key: 'user_id',  header: 'user_id'  },
      { key: 'username', header: 'username' },
      { key: 'status',   header: 'status'   },
      { key: 'time',     header: 'time'     },
    ],
    cast: {
      // đảm bảo mọi giá trị đều là string, không bao giờ là null/undefined
      object: v => (v == null ? '' : String(v)),
    },
  });

  return Buffer.from('\uFEFF' + csv, 'utf-8');
}

/**
 * Tạo tên file CSV an toàn từ session_name (strip ký tự đặc biệt).
 * @param {string} sessionName
 * @param {string} sessionId
 * @returns {string}  vd: "diemdanh-hop-le-2026-sess1.csv"
 */
function buildCsvFilename(sessionName, sessionId) {
  const safeName = sessionName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // bỏ dấu
    .replace(/[^a-zA-Z0-9\s-]/g, '')   // bỏ ký tự đặc biệt
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  const shortId = sessionId.slice(0, 8);
  return `diemdanh-${safeName}-${shortId}.csv`;
}

module.exports = { buildCsvBuffer, buildCsvFilename };
