import { chunk, db, fetchAll } from "./db";
import { aggregateByMember, sumRows, type Agg } from "./stats";
import { kstDayEndIso, kstDayStartIso } from "./format";
import type {
  Announcement,
  ChampStatRow,
  MatchRow,
  Member,
  ParticipantRow,
  PlaySession,
  Season,
  StatRow,
} from "./types";

function fail(message: string): never {
  throw new Error(message);
}

// 시즌 ---------------------------------------------------------------------
export async function getSeasons(): Promise<Season[]> {
  const { data, error } = await db()
    .from("seasons")
    .select("*")
    .order("starts_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail(error.message);
  return (data ?? []) as Season[];
}

export async function getCurrentSeason(): Promise<Season | null> {
  const { data } = await db().from("seasons").select("*").eq("is_current", true).maybeSingle();
  return (data as Season | null) ?? null;
}

/** ?season= 값 해석: 값 없음 = 현재 시즌, "all" = 전체, 그 외 = 시즌 ID */
export async function resolveSeason(param: string | undefined): Promise<{ id: string | null; season: Season | null }> {
  if (param === "all") return { id: null, season: null };
  if (param) {
    const { data } = await db().from("seasons").select("*").eq("id", param).maybeSingle();
    if (data) return { id: (data as Season).id, season: data as Season };
  }
  const cur = await getCurrentSeason();
  return { id: cur?.id ?? null, season: cur };
}

// 세션 ---------------------------------------------------------------------
export async function getOpenSession(): Promise<PlaySession | null> {
  const { data } = await db().from("play_sessions").select("*").eq("status", "open").maybeSingle();
  return (data as PlaySession | null) ?? null;
}

// 공지 ---------------------------------------------------------------------
export async function getAnnouncements(limit: number, includeUnpublished = false): Promise<Announcement[]> {
  let q = db().from("announcements").select("*");
  if (!includeUnpublished) q = q.eq("published", true);
  const { data, error } = await q
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail(error.message);
  return (data ?? []) as Announcement[];
}

// 회원 ---------------------------------------------------------------------
export type MemberLite = Pick<Member, "id" | "chzzk_name" | "riot_game_name" | "riot_tag_line" | "status">;

export async function getMembersByIds(ids: string[]): Promise<Map<string, MemberLite>> {
  const map = new Map<string, MemberLite>();
  for (const part of chunk(Array.from(new Set(ids)), 100)) {
    const { data, error } = await db()
      .from("members")
      .select("id, chzzk_name, riot_game_name, riot_tag_line, status")
      .in("id", part);
    if (error) fail(error.message);
    (data ?? []).forEach((m: any) => map.set(m.id, m as MemberLite));
  }
  return map;
}

// 통계 ---------------------------------------------------------------------
export async function getStatRows(opts: { seasonId?: string | null; memberId?: string }): Promise<StatRow[]> {
  return fetchAll<StatRow>((from, to) => {
    let q = db().from("v_member_stats").select("*");
    if (opts.seasonId) q = q.eq("season_id", opts.seasonId);
    if (opts.memberId) q = q.eq("member_id", opts.memberId);
    return q.order("member_id").order("season_id").order("mode").range(from, to);
  });
}

/** 승인된 회원만, 선택한 시즌(없으면 전체) 기준으로 합산한 전적 */
export async function getRankedAgg(
  seasonId: string | null,
): Promise<{ byMember: Map<string, Agg>; members: Map<string, MemberLite> }> {
  const rows = await getStatRows({ seasonId });
  const all = aggregateByMember(rows);
  const members = await getMembersByIds(Array.from(all.keys()));
  const byMember = new Map<string, Agg>();
  all.forEach((agg, id) => {
    if (members.get(id)?.status === "approved") byMember.set(id, agg);
  });
  return { byMember, members };
}

export type MemberOverview = {
  total: Agg;
  bySeason: { seasonId: string | null; agg: Agg }[];
  byMode: { mode: string; agg: Agg }[];
  champions: { champion: string; agg: Agg }[];
  recent: {
    match_id: string;
    played_at: string;
    mode: string;
    champion: string;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
  }[];
};

export async function getMemberOverview(memberId: string): Promise<MemberOverview> {
  const rows = await getStatRows({ memberId });
  const champRows = await fetchAll<ChampStatRow>((from, to) =>
    db().from("v_member_champion_stats").select("*").eq("member_id", memberId).order("champion").order("season_id").range(from, to),
  );
  const { data: recent } = await db()
    .from("v_member_matches")
    .select("match_id, played_at, mode, champion, win, kills, deaths, assists")
    .eq("member_id", memberId)
    .order("played_at", { ascending: false })
    .limit(15);

  const group = <K extends string>(list: StatRow[] | ChampStatRow[], key: (r: any) => K) => {
    const m = new Map<K, any[]>();
    for (const r of list as any[]) {
      const k = key(r);
      const cur = m.get(k);
      if (cur) cur.push(r);
      else m.set(k, [r]);
    }
    return m;
  };

  const bySeason = Array.from(group(rows, (r) => String(r.season_id)).entries()).map(([k, list]) => ({
    seasonId: k === "null" ? null : k,
    agg: sumRows(list),
  }));
  const byMode = Array.from(group(rows, (r) => r.mode as string).entries()).map(([mode, list]) => ({
    mode,
    agg: sumRows(list),
  }));
  const champions = Array.from(group(champRows, (r) => r.champion as string).entries())
    .map(([champion, list]) => ({ champion, agg: sumRows(list) }))
    .sort((a, b) => b.agg.games - a.agg.games || b.agg.wins - a.agg.wins);

  return { total: sumRows(rows), bySeason, byMode, champions, recent: (recent ?? []) as MemberOverview["recent"] };
}

// 경기 ---------------------------------------------------------------------
export type MatchFilter = {
  mode?: string;
  seasonId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
  includeCancelled?: boolean;
};

export async function getMatches(f: MatchFilter): Promise<{ rows: MatchRow[]; total: number }> {
  let q = db().from("matches").select("*", { count: "exact" });
  if (!f.includeCancelled) q = q.eq("status", "approved");
  if (f.mode) q = q.eq("mode", f.mode);
  if (f.seasonId) q = q.eq("season_id", f.seasonId);
  const fromIso = f.from ? kstDayStartIso(f.from) : null;
  const toIso = f.to ? kstDayEndIso(f.to) : null;
  if (fromIso) q = q.gte("played_at", fromIso);
  if (toIso) q = q.lte("played_at", toIso);
  const start = (Math.max(f.page, 1) - 1) * f.pageSize;
  const { data, count, error } = await q
    .order("played_at", { ascending: false })
    .range(start, start + f.pageSize - 1);
  if (error) fail(error.message);
  return { rows: (data ?? []) as MatchRow[], total: count ?? 0 };
}

export async function getParticipants(matchIds: string[]): Promise<Map<string, ParticipantRow[]>> {
  const map = new Map<string, ParticipantRow[]>();
  for (const part of chunk(matchIds, 50)) {
    const { data, error } = await db()
      .from("match_participants")
      .select("*, members(chzzk_name, status)")
      .in("match_id", part)
      .order("team_id")
      .order("riot_name");
    if (error) fail(error.message);
    for (const p of (data ?? []) as ParticipantRow[]) {
      const cur = map.get(p.match_id);
      if (cur) cur.push(p);
      else map.set(p.match_id, [p]);
    }
  }
  return map;
}

export async function getMatch(id: string, includeCancelled: boolean): Promise<MatchRow | null> {
  const { data } = await db().from("matches").select("*").eq("id", id).maybeSingle();
  const m = data as MatchRow | null;
  if (!m) return null;
  if (m.status !== "approved" && !includeCancelled) return null;
  return m;
}

export async function countMatches(seasonId?: string | null): Promise<number> {
  let q = db().from("matches").select("id", { count: "exact", head: true }).eq("status", "approved");
  if (seasonId) q = q.eq("season_id", seasonId);
  const { count } = await q;
  return count ?? 0;
}

export async function countMembers(status: string): Promise<number> {
  const { count } = await db().from("members").select("id", { count: "exact", head: true }).eq("status", status);
  return count ?? 0;
}
