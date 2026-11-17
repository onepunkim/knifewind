-- KNIFEWIND 1PUN (칼바람 나락) 데이터베이스 구조
-- Supabase 대시보드의 SQL Editor에 이 파일 전체를 붙여 넣고 Run 하면 됩니다.
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.

create extension if not exists pgcrypto;

-- 회원 -----------------------------------------------------------------
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  chzzk_channel_id text not null unique,
  chzzk_name text not null,
  riot_game_name text,
  riot_tag_line text,
  riot_puuid text unique,
  status text not null default 'incomplete'
    check (status in ('incomplete', 'pending', 'approved', 'rejected', 'banned')),
  role text not null default 'member' check (role in ('member', 'admin')),
  reject_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_login_at timestamptz
);

-- 시즌 -----------------------------------------------------------------
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null default current_date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists seasons_one_current on seasons (is_current) where is_current;

-- 시참 세션 (방송 중 시청자 참여를 진행하는 시간대) ----------------------
create table if not exists play_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  season_id uuid references seasons (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references members (id) on delete set null,
  created_at timestamptz not null default now()
);
-- 진행 중인 세션은 동시에 하나만 허용
create unique index if not exists play_sessions_one_open on play_sessions ((true)) where status = 'open';

-- 승인된 경기 ------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  riot_match_id text unique,
  source text not null default 'riot' check (source in ('riot', 'manual')),
  session_id uuid references play_sessions (id) on delete set null,
  season_id uuid references seasons (id) on delete set null,
  mode text not null default 'aram' check (mode in ('aram', 'mayhem', 'custom', 'other')),
  queue_id int,
  played_at timestamptz not null,
  duration_seconds int,
  winning_team int check (winning_team in (100, 200)),
  status text not null default 'approved' check (status in ('approved', 'cancelled')),
  note text,
  approved_by uuid references members (id) on delete set null,
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_played_at_idx on matches (played_at desc);
create index if not exists matches_season_idx on matches (season_id);

create table if not exists match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  member_id uuid references members (id) on delete set null,
  riot_puuid text,
  riot_name text not null,
  champion text not null default '',
  team_id int not null check (team_id in (100, 200)),
  win boolean not null,
  kills int not null default 0,
  deaths int not null default 0,
  assists int not null default 0
);
create index if not exists mp_match_idx on match_participants (match_id);
create index if not exists mp_member_idx on match_participants (member_id);
create unique index if not exists mp_match_puuid_uq
  on match_participants (match_id, riot_puuid) where riot_puuid is not null;

-- 경기 후보 (라이엇 API로 찾았지만 아직 관리자가 승인하지 않은 경기) ------
create table if not exists match_candidates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references play_sessions (id) on delete cascade,
  riot_match_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'approved', 'dismissed')),
  data jsonb,
  member_matches int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, riot_match_id)
);

-- 공지사항 ---------------------------------------------------------------
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- 통계용 뷰 (승인된 경기 + 회원에 연결된 참가자만 집계) --------------------
create or replace view v_member_matches as
select
  mp.id as participant_id,
  mp.member_id,
  mp.match_id,
  mp.champion,
  mp.team_id,
  mp.win,
  mp.kills,
  mp.deaths,
  mp.assists,
  m.played_at,
  m.mode,
  m.season_id,
  m.duration_seconds
from match_participants mp
join matches m on m.id = mp.match_id
where m.status = 'approved' and mp.member_id is not null;

create or replace view v_member_stats as
select
  member_id,
  season_id,
  mode,
  count(*)::int as games,
  (count(*) filter (where win))::int as wins,
  coalesce(sum(kills), 0)::int as kills,
  coalesce(sum(deaths), 0)::int as deaths,
  coalesce(sum(assists), 0)::int as assists
from v_member_matches
group by member_id, season_id, mode;

create or replace view v_member_champion_stats as
select
  member_id,
  season_id,
  champion,
  count(*)::int as games,
  (count(*) filter (where win))::int as wins,
  coalesce(sum(kills), 0)::int as kills,
  coalesce(sum(deaths), 0)::int as deaths,
  coalesce(sum(assists), 0)::int as assists
from v_member_matches
group by member_id, season_id, champion;

-- 보안: 이 사이트는 서버에서만 service_role 키로 데이터베이스에 접근합니다.
-- 외부(anon, authenticated)에서는 어떤 테이블도 직접 읽거나 쓸 수 없게 막습니다.
alter table members enable row level security;
alter table seasons enable row level security;
alter table play_sessions enable row level security;
alter table matches enable row level security;
alter table match_participants enable row level security;
alter table match_candidates enable row level security;
alter table announcements enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 첫 시즌 ------------------------------------------------------------------
insert into seasons (name, is_current)
select '시즌 1', true
where not exists (select 1 from seasons);
