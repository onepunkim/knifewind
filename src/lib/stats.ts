import type { StatRow } from "./types";

export type Agg = {
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  winRate: number; // 0~1
  kda: number;
};

type Counts = { games: number; wins: number; kills: number; deaths: number; assists: number };

/** KDA = (킬 + 어시스트) / 데스. 데스가 0이면 1로 계산합니다. */
export function kda(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(deaths, 1);
}

export function finish(c: Counts): Agg {
  return {
    games: c.games,
    wins: c.wins,
    losses: c.games - c.wins,
    kills: c.kills,
    deaths: c.deaths,
    assists: c.assists,
    winRate: c.games > 0 ? c.wins / c.games : 0,
    kda: kda(c.kills, c.deaths, c.assists),
  };
}

export function sumRows(rows: Counts[]): Agg {
  const c: Counts = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
  for (const r of rows) {
    c.games += r.games;
    c.wins += r.wins;
    c.kills += r.kills;
    c.deaths += r.deaths;
    c.assists += r.assists;
  }
  return finish(c);
}

export function aggregateByMember(rows: StatRow[]): Map<string, Agg> {
  const grouped = new Map<string, StatRow[]>();
  for (const r of rows) {
    const list = grouped.get(r.member_id);
    if (list) list.push(r);
    else grouped.set(r.member_id, [r]);
  }
  const out = new Map<string, Agg>();
  grouped.forEach((list, id) => out.set(id, sumRows(list)));
  return out;
}

/** 순위 미리보기용 정렬: 승리 수 → 승률 → 참여 횟수 */
export function sortByWins(entries: { memberId: string; agg: Agg }[]) {
  return entries.slice().sort(
    (a, b) =>
      b.agg.wins - a.agg.wins ||
      b.agg.winRate - a.agg.winRate ||
      b.agg.games - a.agg.games ||
      a.memberId.localeCompare(b.memberId),
  );
}

export type BoardEntry = { memberId: string; value: number; label: string; sub: string };
export type Board = { key: string; title: string; note: string; entries: BoardEntry[] };

const TOP = 10;

function top(
  byMember: Map<string, Agg>,
  pick: (a: Agg) => number,
  label: (a: Agg) => string,
  sub: (a: Agg) => string,
  eligible: (a: Agg) => boolean,
): BoardEntry[] {
  const list: BoardEntry[] = [];
  byMember.forEach((agg, memberId) => {
    if (!eligible(agg)) return;
    list.push({ memberId, value: pick(agg), label: label(agg), sub: sub(agg) });
  });
  const games = (id: string) => byMember.get(id)?.games ?? 0;
  list.sort((a, b) => b.value - a.value || games(b.memberId) - games(a.memberId) || a.memberId.localeCompare(b.memberId));
  return list.slice(0, TOP);
}

/** 명예의 전당 부문별 순위. 승률과 KDA는 minGames 이상 참여한 회원만 올라갑니다. */
export function buildBoards(byMember: Map<string, Agg>, minGames: number): Board[] {
  const any = (a: Agg) => a.games > 0;
  const enough = (a: Agg) => a.games >= minGames;
  const record = (a: Agg) => `${a.wins}승 ${a.losses}패`;
  const kdaLine = (a: Agg) => `${a.kills}/${a.deaths}/${a.assists}`;
  return [
    {
      key: "games",
      title: "최다 참여",
      note: "시참 경기에 가장 많이 참여한 회원",
      entries: top(byMember, (a) => a.games, (a) => `${a.games}판`, record, any),
    },
    {
      key: "wins",
      title: "최다 승리",
      note: "가장 많이 이긴 회원",
      entries: top(byMember, (a) => a.wins, (a) => `${a.wins}승`, (a) => `${a.games}판 참여`, any),
    },
    {
      key: "winrate",
      title: "최고 승률",
      note: `${minGames}판 이상 참여한 회원만 집계`,
      entries: top(byMember, (a) => a.winRate, (a) => `${(a.winRate * 100).toFixed(1)}%`, record, enough),
    },
    {
      key: "kda",
      title: "최고 KDA",
      note: `${minGames}판 이상 참여한 회원만 집계`,
      entries: top(byMember, (a) => a.kda, (a) => a.kda.toFixed(2), kdaLine, enough),
    },
    {
      key: "kills",
      title: "최다 킬",
      note: "누적 킬 수",
      entries: top(byMember, (a) => a.kills, (a) => `${a.kills}킬`, (a) => `${a.games}판 참여`, any),
    },
    {
      key: "assists",
      title: "최다 어시스트",
      note: "누적 어시스트 수",
      entries: top(byMember, (a) => a.assists, (a) => `${a.assists}어시`, (a) => `${a.games}판 참여`, any),
    },
  ];
}
