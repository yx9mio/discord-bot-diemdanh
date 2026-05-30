export interface AttendeeRecord {
  name: string;
  avatar: string;
  status: 'tham_gia' | 'khong_tham_gia';
  time: string;
}

export interface Session {
  session_name: string;
  attendees: Record<string, AttendeeRecord>;
  display_channel_id: string;
  display_message_id: string | null;
  start_time: string;
}

export type SessionMap = Record<string, Session>;
