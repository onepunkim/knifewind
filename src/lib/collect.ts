import { chunk, db } from "./db";
import { fetchMatchData, matchIdsInWindow, RiotError } from "./riot";
import { countMemberMatches } from "./riot-parse";

export type ScanReport = {
  scannedMembers: number;
  totalMembers: number;
  newCandidates: number;
  filled: number;
  pending: number;
  stoppedBy: null | "time" | "rate";
  error?: string;
};

/**
 * 시참 세션의 시간대에 승인 회원들이 한 경기를 라이엇 API로 찾아 '경기 후보'로 저장합니다.
 * 경기 여부를 확정하지 않습니다. 후보는 관리자가 승인해야만 기록에 반영됩니다.
 * 서버 실행 시간 제한을 넘지 않도록 budgetMs 안에서 일하고, 남은 것은 다시 눌러 이어서 처리합니다.
 */
export async function scanSession(sessionId: string, budgetMs = 40000): Promise<ScanReport> {
  const deadline = Date.now() + budgetMs;
  const { data: session } = await db().from("play_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) throw new Error("세션을 찾을 수 없습니다.");

  // 세션 시작 1시간 전 ~ 종료(진행 중이면 지금) 30분 후까지 넉넉히 찾습니다.
  const startSec = Math.floor(new Date(session.started_at).getTime() / 1000) - 3600;
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const endSec = Math.ceil(endMs / 1000) + 1800;

  const { data: members, error: mErr } = await db()
    .from("members")
    .select("id, riot_puuid")
    .eq("status", "approved")
    .not("riot_puuid", "is", null);
  if (mErr) throw new Error(mErr.message);
  const list: { id: string; riot_puuid: string }[] = members ?? [];
  const puuids = new Set<string>(list.map((m) => m.riot_puuid));

  const report: ScanReport = {
    scannedMembers: 0,
    totalMembers: list.length,
    newCandidates: 0,
    filled: 0,
    pending: 0,
    stoppedBy: null,
  };

  // 1) 회원별 경기 ID 모으기
  const ids = new Set<string>();
  for (const m of list) {
    if (Date.now() > deadline) {
      report.stoppedBy = "time";
      break;
    }
    try {
      const found = await matchIdsInWindow(m.riot_puuid, startSec, endSec, deadline);
      found.forEach((id) => ids.add(id));
      report.scannedMembers++;
    } catch (e) {
      if (e instanceof RiotError) {
        report.error = e.message;
        if (e.kind === "rate") report.stoppedBy = "rate";
        break;
      }
      throw e;
    }
  }

  // 2) 이미 기록된 경기는 빼고, 새 후보만 저장
  const idList = Array.from(ids);
  const known = new Set<string>();
  for (const part of chunk(idList, 100)) {
    const { data } = await db().from("matches").select("riot_match_id").in("riot_match_id", part);
    (data ?? []).forEach((r: any) => known.add(r.riot_match_id));
  }
  const existing = new Set<string>();
  {
    const { data } = await db().from("match_candidates").select("riot_match_id").eq("session_id", sessionId);
    (data ?? []).forEach((r: any) => existing.add(r.riot_match_id));
  }
  const fresh = idList.filter((id) => !known.has(id) && !existing.has(id));
  if (fresh.length > 0) {
    const { error } = await db()
      .from("match_candidates")
      .upsert(
        fresh.map((id) => ({ session_id: sessionId, riot_match_id: id })),
        { onConflict: "session_id,riot_match_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    report.newCandidates = fresh.length;
  }

  // 3) 아직 내용을 못 가져온 후보를 채우기
  const { data: pend } = await db()
    .from("match_candidates")
    .select("id, riot_match_id")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("created_at")
    .limit(300);
  for (const c of pend ?? []) {
    if (Date.now() > deadline) {
      if (!report.stoppedBy) report.stoppedBy = "time";
      break;
    }
    try {
      const data = await fetchMatchData(c.riot_match_id, deadline);
      if (!data) {
        await db().from("match_candidates").update({ status: "dismissed" }).eq("id", c.id);
        continue;
      }
      await db()
        .from("match_candidates")
        .update({ status: "ready", data, member_matches: countMemberMatches(data, puuids) })
        .eq("id", c.id);
      report.filled++;
    } catch (e) {
      if (e instanceof RiotError) {
        report.error = e.message;
        if (e.kind === "rate" && !report.stoppedBy) report.stoppedBy = "rate";
        break;
      }
      throw e;
    }
  }

  const { count } = await db()
    .from("match_candidates")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "pending");
  report.pending = count ?? 0;
  return report;
}
