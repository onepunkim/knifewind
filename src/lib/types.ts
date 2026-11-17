export type Mode = "aram" | "mayhem" | "custom" | "other";
export type MemberStatus = "incomplete" | "pending" | "approved" | "rejected" | "banned";
export type Team = 100 | 200;

export type Member = {
  id: string;
  chzzk_channel_id: string;
  chzzk_name: string;
  riot_game_name: string | null;
  riot_tag_line: string | null;
  riot_puuid: string | null;
  status: MemberStatus;
  role: "member" | "admin";
  reject_reason: string | null;
  created_at: string;
  approved_at: string | null;
  last_login_at: string | null;
};

export type Season = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string | null;
  is_current: boolean;
};

export type PlaySession = {
  id: string;
  title: string;
  season_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: "open" | "closed";
};

export type MatchRow = {
  id: string;
  riot_match_id: string | null;
  source: "riot" | "manual";
  session_id: string | null;
  season_id: string | null;
  mode: Mode;
  queue_id: number | null;
  played_at: string;
  duration_seconds: number | null;
  winning_team: Team | null;
  status: "approved" | "cancelled";
  note: string | null;
  approved_at: string;
};

export type ParticipantRow = {
  id: string;
  match_id: string;
  member_id: string | null;
  riot_puuid: string | null;
  riot_name: string;
  champion: string;
  team_id: Team;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  members?: { chzzk_name: string; status: string } | null;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  published: boolean;
  created_at: string;
};

/** 라이엇 API 경기 정보를 이 사이트에서 쓰기 좋게 줄인 모양 */
export type CandParticipant = {
  puuid: string;
  name: string;
  champion: string;
  teamId: Team;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
};

export type CandData = {
  matchId: string;
  queueId: number;
  gameMode: string;
  gameType: string;
  startedAt: string;
  durationSec: number;
  winningTeam: Team | null;
  participants: CandParticipant[];
};

export type CandidateRow = {
  id: string;
  session_id: string;
  riot_match_id: string;
  status: "pending" | "ready" | "approved" | "dismissed";
  data: CandData | null;
  member_matches: number;
  created_at: string;
};

export type StatRow = {
  member_id: string;
  season_id: string | null;
  mode: Mode;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
};

export type ChampStatRow = {
  member_id: string;
  season_id: string | null;
  champion: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
};
