"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getChampNames, normalizeChampion } from "@/lib/champions";
import { scanSession, type ScanReport } from "@/lib/collect";
import { db } from "@/lib/db";
import { kstInputToIso } from "@/lib/format";
import { lookupRiotId, RiotError } from "@/lib/riot";
import { guessMode } from "@/lib/riot-parse";
import type { CandData, Member, Mode } from "@/lib/types";

const MODES: Mode[] = ["aram", "mayhem", "custom", "other"];

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Math.max(0, Math.min(999, parseInt(s(fd, k), 10) || 0));

function withMsg(path: string, kind: "ok" | "err", msg: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`;
}
function go(path: string, kind: "ok" | "err", msg: string): never {
  redirect(withMsg(path, kind, msg));
}
/** 폼의 back 값이 관리자 페이지 안일 때만 그곳으로 돌아갑니다. */
function backTo(fd: FormData, fallback: string): string {
  const b = s(fd, "back");
  return b.startsWith("/admin") ? b : fallback;
}
function isMode(v: string): v is Mode {
  return (MODES as string[]).includes(v);
}

// 회원 -----------------------------------------------------------------------
export async function approveMember(fd: FormData): Promise<void> {
  await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const id = s(fd, "id");
  const { data: m } = await db().from("members").select("riot_puuid, chzzk_name").eq("id", id).maybeSingle();
  if (!m) go(back, "err", "회원을 찾을 수 없습니다.");
  if (!m!.riot_puuid) go(back, "err", "Riot ID가 등록되지 않은 회원은 승인할 수 없습니다.");
  const { error } = await db()
    .from("members")
    .update({ status: "approved", approved_at: new Date().toISOString(), reject_reason: null })
    .eq("id", id);
  if (error) go(back, "err", "승인하지 못했습니다.");
  go(back, "ok", `${m!.chzzk_name} 님을 승인했습니다.`);
}

export async function rejectMember(fd: FormData): Promise<void> {
  await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const id = s(fd, "id");
  const reason = s(fd, "reason").slice(0, 200);
  const { error } = await db().from("members").update({ status: "rejected", reject_reason: reason || null }).eq("id", id);
  if (error) go(back, "err", "거절하지 못했습니다.");
  go(back, "ok", "가입을 거절했습니다. 회원은 Riot ID를 고쳐 다시 신청할 수 있습니다.");
}

export async function banMember(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const id = s(fd, "id");
  if (id === admin.id) go(back, "err", "본인 계정은 정지할 수 없습니다.");
  const { error } = await db().from("members").update({ status: "banned" }).eq("id", id);
  if (error) go(back, "err", "정지하지 못했습니다.");
  go(back, "ok", "이용을 정지했습니다. 이 회원은 로그인할 수 없고 랭킹에서도 빠집니다.");
}

export async function unbanMember(fd: FormData): Promise<void> {
  await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const { error } = await db().from("members").update({ status: "pending" }).eq("id", s(fd, "id"));
  if (error) go(back, "err", "정지를 풀지 못했습니다.");
  go(back, "ok", "정지를 풀었습니다. 승인 대기 상태로 돌아갑니다.");
}

export async function setMemberRole(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const id = s(fd, "id");
  const role = s(fd, "role") === "admin" ? "admin" : "member";
  if (id === admin.id) go(back, "err", "본인의 권한은 바꿀 수 없습니다.");
  const { error } = await db().from("members").update({ role }).eq("id", id);
  if (error) go(back, "err", "권한을 바꾸지 못했습니다.");
  go(back, "ok", role === "admin" ? "관리자로 지정했습니다." : "관리자 권한을 해제했습니다.");
}

/** 모든 승인 회원의 Riot ID로 PUUID를 다시 조회합니다. (API 키를 바꾼 뒤 필요할 수 있습니다) */
export async function refreshPuuids(fd: FormData): Promise<void> {
  await requireAdmin();
  const back = backTo(fd, "/admin/members");
  const deadline = Date.now() + 40000;
  const { data } = await db()
    .from("members")
    .select("id, riot_game_name, riot_tag_line, riot_puuid")
    .not("riot_game_name", "is", null)
    .not("riot_tag_line", "is", null);
  const list = (data ?? []) as Pick<Member, "id" | "riot_game_name" | "riot_tag_line" | "riot_puuid">[];
  let changed = 0;
  let checked = 0;
  let error = "";
  for (const m of list) {
    if (Date.now() > deadline) break;
    try {
      const acc = await lookupRiotId(m.riot_game_name!, m.riot_tag_line!);
      checked++;
      if (acc && acc.puuid !== m.riot_puuid) {
        await db().from("members").update({ riot_puuid: acc.puuid }).eq("id", m.id);
        changed++;
      }
    } catch (e) {
      error = e instanceof RiotError ? e.message : "조회 중 문제가 생겼습니다.";
      break;
    }
  }
  const msg = `${checked}/${list.length}명 확인, ${changed}명의 PUUID가 바뀌었습니다.`;
  if (error) go(back, "err", `${msg} 중단됨: ${error}`);
  go(back, "ok", checked < list.length ? `${msg} 시간이 부족해 일부만 확인했습니다. 다시 눌러 이어서 진행해 주세요.` : msg);
}

// 시참 세션 ---------------------------------------------------------------------
export async function startSession(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const title = s(fd, "title").slice(0, 80);
  if (!title) go("/admin/sessions", "err", "세션 이름을 입력해 주세요.");
  let seasonId: string | null = s(fd, "season_id") || null;
  if (!seasonId) {
    const { data } = await db().from("seasons").select("id").eq("is_current", true).maybeSingle();
    seasonId = data?.id ?? null;
  }
  const { data, error } = await db()
    .from("play_sessions")
    .insert({ title, season_id: seasonId, created_by: admin.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") go("/admin/sessions", "err", "이미 진행 중인 세션이 있습니다. 먼저 종료해 주세요.");
    go("/admin/sessions", "err", "세션을 만들지 못했습니다.");
  }
  go(`/admin/sessions/${data!.id}`, "ok", "시참 세션을 시작했습니다. 경기가 끝나면 '경기 후보 조회'를 눌러 주세요.");
}

export async function closeSession(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const { error } = await db()
    .from("play_sessions")
    .update({ status: "closed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");
  if (error) go(`/admin/sessions/${id}`, "err", "세션을 종료하지 못했습니다.");
  go(`/admin/sessions/${id}`, "ok", "세션을 종료했습니다. 마지막으로 '경기 후보 조회'를 한 번 더 눌러 빠진 경기가 없는지 확인해 주세요.");
}

function scanMessage(r: ScanReport): string {
  if (r.totalMembers === 0) return "Riot ID가 등록된 승인 회원이 없어 조회할 대상이 없습니다.";
  const parts = [
    `회원 ${r.scannedMembers}/${r.totalMembers}명 조회`,
    `새 후보 ${r.newCandidates}개`,
    `내용 확인 ${r.filled}개`,
  ];
  if (r.pending > 0) parts.push(`아직 ${r.pending}개 남음`);
  return parts.join(" · ");
}

export async function scanSessionAction(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const path = `/admin/sessions/${id}`;
  let report: ScanReport;
  try {
    report = await scanSession(id, 40000);
  } catch (e) {
    console.error("[collect] 후보 조회 실패", e);
    go(path, "err", "경기 후보를 조회하지 못했습니다. 환경 변수와 Riot API 키를 확인해 주세요.");
  }
  const msg = scanMessage(report!);
  if (report!.error) go(path, "err", `${msg}. 중단 사유: ${report!.error}`);
  if (report!.stoppedBy || report!.pending > 0) {
    go(path, "ok", `${msg}. 시간이나 요청 제한 때문에 일부만 처리했습니다. 잠시 뒤 다시 눌러 이어서 진행해 주세요.`);
  }
  go(path, "ok", msg);
}

export async function approveCandidate(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = s(fd, "id");
  const { data: cand } = await db().from("match_candidates").select("*").eq("id", id).maybeSingle();
  const back = `/admin/sessions/${cand?.session_id ?? ""}`;
  if (!cand || cand.status !== "ready" || !cand.data) go(back, "err", "승인할 수 없는 후보입니다. 화면을 새로 고쳐 주세요.");
  const d = cand!.data as CandData;

  const { data: dup } = await db().from("matches").select("id").eq("riot_match_id", d.matchId).maybeSingle();
  if (dup) go(back, "err", "이미 등록된 경기입니다.");

  const modeIn = s(fd, "mode");
  const mode: Mode = isMode(modeIn) ? modeIn : guessMode(d.queueId, d.gameMode, d.gameType);

  let seasonId: string | null = s(fd, "season_id") || null;
  if (!seasonId) {
    const { data: sess } = await db().from("play_sessions").select("season_id").eq("id", cand!.session_id).maybeSingle();
    seasonId = sess?.season_id ?? null;
  }

  const puuids = d.participants.map((p) => p.puuid).filter(Boolean);
  const { data: mem } = await db().from("members").select("id, riot_puuid").in("riot_puuid", puuids);
  const byPuuid = new Map<string, string>((mem ?? []).map((m: any): [string, string] => [m.riot_puuid, m.id]));

  const { data: match, error } = await db()
    .from("matches")
    .insert({
      riot_match_id: d.matchId,
      source: "riot",
      session_id: cand!.session_id,
      season_id: seasonId,
      mode,
      queue_id: d.queueId,
      played_at: d.startedAt,
      duration_seconds: d.durationSec,
      winning_team: d.winningTeam,
      status: "approved",
      approved_by: admin.id,
    })
    .select("id")
    .single();
  if (error) go(back, "err", "경기를 저장하지 못했습니다.");

  const rows = d.participants.map((p) => ({
    match_id: match!.id,
    member_id: byPuuid.get(p.puuid) ?? null,
    riot_puuid: p.puuid || null,
    riot_name: p.name,
    champion: p.champion,
    team_id: p.teamId,
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
  }));
  const { error: pErr } = await db().from("match_participants").insert(rows);
  if (pErr) {
    await db().from("matches").delete().eq("id", match!.id); // 반쯤 저장된 경기가 남지 않게 되돌립니다
    go(back, "err", "참가자 기록을 저장하지 못해 승인을 취소했습니다.");
  }

  await db().from("match_candidates").update({ status: "approved" }).eq("id", id);
  go(back, "ok", "경기를 승인했습니다. 회원 전적과 랭킹에 반영됩니다.");
}

export async function dismissCandidate(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const { data: cand } = await db().from("match_candidates").select("session_id").eq("id", id).maybeSingle();
  await db().from("match_candidates").update({ status: "dismissed" }).eq("id", id).eq("status", "ready");
  go(`/admin/sessions/${cand?.session_id ?? ""}`, "ok", "시참 경기가 아닌 것으로 표시했습니다.");
}

export async function restoreCandidate(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const { data: cand } = await db().from("match_candidates").select("session_id, data").eq("id", id).maybeSingle();
  await db()
    .from("match_candidates")
    .update({ status: cand?.data ? "ready" : "pending" })
    .eq("id", id)
    .eq("status", "dismissed");
  go(`/admin/sessions/${cand?.session_id ?? ""}`, "ok", "후보 목록으로 되돌렸습니다.");
}

// 경기 -----------------------------------------------------------------------
type Slot = { name: string; champ: string; k: number; d: number; a: number; team: 100 | 200 };

function readSlots(fd: FormData): Slot[] {
  const out: Slot[] = [];
  for (const team of [100, 200] as const) {
    for (let i = 0; i < 5; i++) {
      const name = s(fd, `n_${team}_${i}`);
      if (!name) continue;
      out.push({ name, champ: s(fd, `c_${team}_${i}`), k: num(fd, `k_${team}_${i}`), d: num(fd, `d_${team}_${i}`), a: num(fd, `a_${team}_${i}`), team });
    }
  }
  return out;
}

export async function createManualMatch(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const back = "/admin/matches/new";
  const playedAt = kstInputToIso(s(fd, "played_at"));
  if (!playedAt) go(back, "err", "경기 날짜와 시간을 입력해 주세요.");
  const modeIn = s(fd, "mode");
  const mode: Mode = isMode(modeIn) ? modeIn : "custom";
  const winning = s(fd, "winning_team") === "200" ? 200 : s(fd, "winning_team") === "100" ? 100 : null;
  if (!winning) go(back, "err", "이긴 팀을 골라 주세요.");
  const slots = readSlots(fd);
  if (slots.length === 0) go(back, "err", "참가자를 한 명 이상 입력해 주세요.");

  const { data: members } = await db()
    .from("members")
    .select("id, chzzk_name, riot_game_name, riot_tag_line, riot_puuid");
  const list = (members ?? []) as Pick<Member, "id" | "chzzk_name" | "riot_game_name" | "riot_tag_line" | "riot_puuid">[];
  const names = await getChampNames();

  const used = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const sl of slots) {
    const key = sl.name.toLowerCase();
    const found = list.find(
      (m) => (m.riot_game_name && m.riot_tag_line && `${m.riot_game_name}#${m.riot_tag_line}`.toLowerCase() === key) || m.chzzk_name.toLowerCase() === key,
    );
    if (found) {
      if (used.has(found.id)) go(back, "err", `${sl.name} 님이 두 번 입력되었습니다.`);
      used.add(found.id);
    }
    rows.push({
      member_id: found?.id ?? null,
      riot_puuid: found?.riot_puuid ?? null,
      riot_name: found?.riot_game_name && found.riot_tag_line ? `${found.riot_game_name}#${found.riot_tag_line}` : sl.name,
      champion: normalizeChampion(sl.champ, names),
      team_id: sl.team,
      win: sl.team === winning,
      kills: sl.k,
      deaths: sl.d,
      assists: sl.a,
    });
  }

  const dur = parseInt(s(fd, "duration_min"), 10);
  const { data: match, error } = await db()
    .from("matches")
    .insert({
      source: "manual",
      season_id: s(fd, "season_id") || null,
      mode,
      played_at: playedAt,
      duration_seconds: Number.isFinite(dur) && dur > 0 ? dur * 60 : null,
      winning_team: winning,
      status: "approved",
      note: s(fd, "note").slice(0, 300) || null,
      approved_by: admin.id,
    })
    .select("id")
    .single();
  if (error) go(back, "err", "경기를 저장하지 못했습니다.");

  const { error: pErr } = await db()
    .from("match_participants")
    .insert(rows.map((r) => ({ ...r, match_id: match!.id })));
  if (pErr) {
    await db().from("matches").delete().eq("id", match!.id);
    go(back, "err", "참가자 기록을 저장하지 못했습니다.");
  }
  go(`/admin/matches/${match!.id}`, "ok", "경기를 등록했습니다.");
}

export async function updateMatch(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const back = `/admin/matches/${id}`;
  const playedAt = kstInputToIso(s(fd, "played_at"));
  if (!playedAt) go(back, "err", "경기 날짜와 시간을 확인해 주세요.");
  const modeIn = s(fd, "mode");
  if (!isMode(modeIn)) go(back, "err", "게임 모드를 골라 주세요.");
  const winning = s(fd, "winning_team") === "200" ? 200 : s(fd, "winning_team") === "100" ? 100 : null;
  const dur = parseInt(s(fd, "duration_min"), 10);

  const { error } = await db()
    .from("matches")
    .update({
      played_at: playedAt,
      mode: modeIn,
      season_id: s(fd, "season_id") || null,
      winning_team: winning,
      duration_seconds: Number.isFinite(dur) && dur > 0 ? dur * 60 : null,
      note: s(fd, "note").slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) go(back, "err", "경기 정보를 저장하지 못했습니다.");

  const names = await getChampNames();
  const { data: parts } = await db().from("match_participants").select("id, team_id").eq("match_id", id);
  for (const p of parts ?? []) {
    const { error: e } = await db()
      .from("match_participants")
      .update({
        champion: normalizeChampion(s(fd, `c_${p.id}`), names),
        kills: num(fd, `k_${p.id}`),
        deaths: num(fd, `d_${p.id}`),
        assists: num(fd, `a_${p.id}`),
        win: winning ? p.team_id === winning : false,
      })
      .eq("id", p.id);
    if (e) go(back, "err", "참가자 기록을 저장하지 못했습니다.");
  }
  go(back, "ok", "수정했습니다. 회원 통계에 바로 반영됩니다.");
}

export async function setMatchStatus(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const status = s(fd, "status") === "cancelled" ? "cancelled" : "approved";
  const back = backTo(fd, `/admin/matches/${id}`);
  const { error } = await db().from("matches").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) go(back, "err", "상태를 바꾸지 못했습니다.");
  go(back, "ok", status === "cancelled" ? "승인을 취소했습니다. 이 경기는 통계에서 빠집니다." : "다시 승인했습니다. 통계에 반영됩니다.");
}

export async function deleteMatch(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const { data: m } = await db().from("matches").select("riot_match_id").eq("id", id).maybeSingle();
  const { error } = await db().from("matches").delete().eq("id", id);
  if (error) go(`/admin/matches/${id}`, "err", "삭제하지 못했습니다.");
  if (m?.riot_match_id) {
    // 다시 검토할 수 있도록 후보를 목록으로 되돌립니다
    await db()
      .from("match_candidates")
      .update({ status: "ready" })
      .eq("riot_match_id", m.riot_match_id)
      .eq("status", "approved");
  }
  go("/admin/matches", "ok", "경기를 삭제했습니다.");
}

// 시즌 -----------------------------------------------------------------------
export async function createSeason(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = s(fd, "name").slice(0, 40);
  if (!name) go("/admin/seasons", "err", "시즌 이름을 입력해 주세요.");
  const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(s(fd, "starts_on")) ? s(fd, "starts_on") : undefined;
  const { error } = await db().from("seasons").insert({ name, ...(startsOn ? { starts_on: startsOn } : {}) });
  if (error) go("/admin/seasons", "err", "시즌을 만들지 못했습니다.");
  go("/admin/seasons", "ok", "시즌을 만들었습니다. 아래에서 '현재 시즌으로 지정'을 눌러야 새 경기가 이 시즌에 들어갑니다.");
}

export async function setCurrentSeason(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  await db().from("seasons").update({ is_current: false }).eq("is_current", true);
  const { error } = await db().from("seasons").update({ is_current: true }).eq("id", id);
  if (error) go("/admin/seasons", "err", "현재 시즌을 바꾸지 못했습니다.");
  go("/admin/seasons", "ok", "현재 시즌을 바꿨습니다.");
}

export async function updateSeason(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const name = s(fd, "name").slice(0, 40);
  if (!name) go("/admin/seasons", "err", "시즌 이름을 입력해 주세요.");
  const ok = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const patch: Record<string, unknown> = { name, ends_on: ok(s(fd, "ends_on")) ? s(fd, "ends_on") : null };
  if (ok(s(fd, "starts_on"))) patch.starts_on = s(fd, "starts_on");
  const { error } = await db().from("seasons").update(patch).eq("id", id);
  if (error) go("/admin/seasons", "err", "시즌을 저장하지 못했습니다.");
  go("/admin/seasons", "ok", "시즌을 저장했습니다.");
}

// 공지 -----------------------------------------------------------------------
export async function saveAnnouncement(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = s(fd, "id");
  const title = s(fd, "title").slice(0, 100);
  if (!title) go("/admin/announcements", "err", "제목을 입력해 주세요.");
  const row = {
    title,
    body: String(fd.get("body") ?? "").slice(0, 3000),
    pinned: fd.get("pinned") === "on",
    published: fd.get("published") === "on",
  };
  const { error } = id ? await db().from("announcements").update(row).eq("id", id) : await db().from("announcements").insert(row);
  if (error) go("/admin/announcements", "err", "공지를 저장하지 못했습니다.");
  go("/admin/announcements", "ok", id ? "공지를 수정했습니다." : "공지를 올렸습니다.");
}

export async function deleteAnnouncement(fd: FormData): Promise<void> {
  await requireAdmin();
  const { error } = await db().from("announcements").delete().eq("id", s(fd, "id"));
  if (error) go("/admin/announcements", "err", "삭제하지 못했습니다.");
  go("/admin/announcements", "ok", "공지를 삭제했습니다.");
}
