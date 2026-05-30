export type AttendanceStatus = 'tham_gia' | 'khong_tham_gia';

export interface AttendeeRecord {
  userId: string;
  name: string;
  avatar: string;
  status: AttendanceStatus;
  time: string;
}

export interface Session {
  session_name: string;
  attendees: Record<string, AttendeeRecord>;
  display_channel_id: string;
  display_message_id: string | null;
  announce_channel_id: string;
  announce_message_id: string | null;
  allowed_role_name: string;
  ping_role_id: string | null;
  reminder_minutes: number | null;
  reminder_sent: boolean;
  auto_close_at: string | null;
  created_by: string;
  start_time: string;
}

export interface HistorySession extends Session {
  ended_at: string;
  total_tham_gia: number;
  total_khong_tham_gia: number;
  total_attendees: number;
}

export interface GuildStatsMember {
  userId: string;
  name: string;
  tham_gia_count: number;
  khong_tham_gia_count: number;
  total_count: number;
}

export interface StorageShape {
  sessions: Record<string, Session>;
  history: Record<string, HistorySession[]>;
}
