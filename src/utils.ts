import { AttachmentBuilder } from 'discord.js';
import { HistorySession, Session } from './types.js';

export function nowTime(): string {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

export function nowDateTime(): string {
  return new Date().toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function addMinutesIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function toLocalDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function hasRequiredRole(roleNames: string[], requiredRoleName: string): boolean {
  return roleNames.some((name) => name === requiredRoleName);
}

export function buildExportAttachment(session: Session | HistorySession): AttachmentBuilder {
  const attendees = Object.values(session.attendees);
  const thamGia = attendees.filter((a) => a.status === 'tham_gia');
  const khongThamGia = attendees.filter((a) => a.status === 'khong_tham_gia');

  const content = [
    `PHIÊN: ${session.session_name}`,
    `BẮT ĐẦU: ${session.start_time}`,
    '',
    `THAM GIA (${thamGia.length})`,
    ...thamGia.map((a, i) => `${i + 1}. ${a.name} - ${a.time}`),
    '',
    `KHÔNG THAM GIA (${khongThamGia.length})`,
    ...khongThamGia.map((a, i) => `${i + 1}. ${a.name} - ${a.time}`),
    '',
    `TỔNG: ${attendees.length}`,
  ].join('\n');

  return new AttachmentBuilder(Buffer.from(content, 'utf-8'), {
    name: `diemdanh-${Date.now()}.txt`,
  });
}
