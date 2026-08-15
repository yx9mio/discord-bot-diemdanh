'use strict';
// utils/attendanceExcel.js — Xuất danh sách điểm danh ra file .xlsx (exceljs, thuần JS)
const ExcelJS = require('exceljs');
const { DateTime } = require('luxon');

const STATUS_LABELS = {
  tham_gia:       '✅ Đúng giờ',
  tre:            '⏰ Trễ',
  khong_tham_gia: '❌ Vắng',
  co_phep:        '📋 Có phép',
};

function _fmtTime(iso) {
  if (!iso) return '';
  const d = DateTime.fromISO(iso, { zone: 'UTC' }).setZone('Asia/Ho_Chi_Minh');
  return d.isValid ? d.toFormat('dd/MM/yyyy HH:mm:ss') : String(iso);
}

/**
 * Tạo buffer .xlsx chứa toàn bộ thành viên của phiên (không theo filter).
 * @param {object} session
 * @param {Array}  attended
 * @param {object|null} guild
 * @returns {Promise<Buffer>}
 */
async function buildAttendanceExcel(session, attended = [], guild = null) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Điểm danh');

  ws.columns = [
    { header: 'STT',    key: 'stt',    width: 6  },
    { header: 'Tên',    key: 'name',   width: 26 },
    { header: 'Phái',   key: 'phai',   width: 18 },
    { header: 'Trạng thái', key: 'status', width: 18 },
    { header: 'Thời gian điểm danh', key: 'time', width: 22 },
  ];

  const phaiRoleIds = session.phai_role_ids ?? [];
  for (const [i, a] of attended.entries()) {
    const member = guild?.members?.cache?.get(a.user_id);
    const phaiNames = phaiRoleIds
      .filter(rid => member?.roles?.cache?.has(rid))
      .map(rid => guild?.roles?.cache?.get(rid)?.name)
      .filter(Boolean);
    ws.addRow({
      stt:    i + 1,
      name:   member?.displayName ?? a.username ?? a.user_id,
      phai:   phaiNames.join(', '),
      status: STATUS_LABELS[a.status] ?? a.status,
      time:   _fmtTime(a.checked_in_at),
    });
  }

  // Header đậm + auto filter
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(2, attended.length + 1), column: 5 } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

module.exports = { buildAttendanceExcel };
