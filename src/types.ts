export type AttendanceStatus = 'tham_gia' | 'khong_tham_gia';

export interface AttendeeRecord {
  user_id: string;
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
  role_id: string | null;
  role_name: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  reminder_minutes_before_end: number | null;
  reminder_sent: boolean;
  ended: boolean;
  /** Member IDs with the attendance role, cached at session start */
  eligible_member_ids: string[];
}

export interface GuildConfig {
  allowed_role_id: string | null;
  allowed_role_name: string;
  admin_role_id: string | null;
  admin_role_name: string;
}

export interface HistorySession {
  session_name: string;
  start_time: string;
  end_time: string;
  role_name: string;
  attendees: Record<string, AttendeeRecord>;
  total_tham_gia: number;
  total_khong_tham_gia: number;
  eligible_count: number;
}

/** Per-member stats stored in members.json */
export interface MemberStats {
  user_id: string;
  name: string;
  total_sessions: number;
  joined: number;
  declined: number;
  /** ISO date strings of sessions where status === 'tham_gia' */
  joined_dates: string[];
  current_streak: number;
  max_streak: number;
  /** Milestone counts already announced to avoid duplicates */
  milestones_announced: number[];
}

export type SessionMap = Record<string, Session>;
export type ConfigMap = Record<string, GuildConfig>;
export type HistoryMap = Record<string, HistorySession[]>;
export type MemberStatsMap = Record<string, Record<string, MemberStats>>; // guildId -> userId -> stats
