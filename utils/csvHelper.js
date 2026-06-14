'use strict';
function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvBuffer(headers, rows) {
  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => headers.map(h => escapeCsv(row[h] ?? '')).join(',')),
  ];
  return Buffer.from('\uFEFF' + lines.join('\n'), 'utf8');
}

function buildCsvFilename(prefix = 'export', ext = 'csv') {
  const now = new Date();
  const ds = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${prefix}_${ds}.${ext}`;
}

module.exports = { buildCsvBuffer, buildCsvFilename };
