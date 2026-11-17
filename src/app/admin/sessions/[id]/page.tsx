import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { champLabel, getChampNames, type ChampNames } from "@/lib/champions";
import { chunk, db } from "@/lib/db";
import { fmtDateTime, fmtDuration, MODE_OPTIONS } from "@/lib/format";
import { getSeasons } from "@/lib/queries";
import { guessMode } from "@/lib/riot-parse";
import type { CandData, CandidateRow, PlaySession, Season } from "@/lib/types";
import {
  approveCandidate,
  closeSession,
  dismissCandidate,
  restoreCandidate,
  scanSessionAction,
} from "@/app/actions/admin";
import { Empty, Flash, ModeBadge, SectionHead, TeamBadge, str } from "@/components/ui";

export const metadata = { title: "시참 세션" };
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 후보 조회는 시간이 걸릴 수 있습니다 (Vercel 함수 최대 시간)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Known = Map<string, string>; // puuid -> 치지직 닉네임

function Players({ d, team, known, names }: { d: CandData; team: 100 | 200; known: Known; names: ChampNames }) {
  const list = d.participants.filter((p) => p.teamId === team);
  const win = list[0]?.win;
  return (
    <div className={`team ${team === 100 ? "blue" : "red"}`}>
      <h3><TeamBadge team={team} win={win} /></h3>
      {list.map((p) => {
        const member = known.get(p.puuid);
        return (
          <div className="player" key={p.puuid || p.name}>
            <span className="who">
              {member ? <b>{member}</b> : <span className="nonmember">{p.name}</span>}{" "}
              <span className="muted small">{champLabel(names, p.champion)}</span>
            </span>
            <span className="num muted">{p.kills}/{p.deaths}/{p.assists}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminSessionPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  if (!UUID.test(params.id)) notFound();
  const { data: sdata } = await db().from("play_sessions").select("*").eq("id", params.id).maybeSingle();
  if (!sdata) notFound();
  const session = sdata as PlaySession;

  const [{ data: cdata }, seasons, names] = await Promise.all([
    db().from("match_candidates").select("*").eq("session_id", session.id).order("created_at"),
    getSeasons(),
    getChampNames(),
  ]);
  const cands = (cdata ?? []) as CandidateRow[];
  const ready = cands
    .filter((c) => c.status === "ready" && c.data)
    .sort((a, b) => b.member_matches - a.member_matches || (b.data!.startedAt > a.data!.startedAt ? 1 : -1));
  const pending = cands.filter((c) => c.status === "pending").length;
  const approved = cands.filter((c) => c.status === "approved").length;
  const dismissed = cands.filter((c) => c.status === "dismissed");

  // 후보 참가자 중 사이트 회원인 사람의 이름 찾기
  const puuids = Array.from(new Set(cands.flatMap((c) => (c.data?.participants ?? []).map((p) => p.puuid).filter(Boolean))));
  const known: Known = new Map();
  for (const part of chunk(puuids, 100)) {
    const { data } = await db().from("members").select("riot_puuid, chzzk_name, status").in("riot_puuid", part);
    (data ?? []).forEach((m: any) => {
      if (m.status === "approved") known.set(m.riot_puuid, m.chzzk_name);
    });
  }

  const startMs = new Date(session.started_at).getTime();
  const endMs = session.ended_at ? new Date(session.ended_at).getTime() : null;
  const defaultSeason = session.season_id ?? seasons.find((s: Season) => s.is_current)?.id ?? "";

  return (
    <>
      <SectionHead title={session.title}>
        <Link href="/admin/sessions" className="small">← 세션 목록</Link>
      </SectionHead>
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      <section className="card gilded stack">
        <div className="row">
          <span className={`live ${session.status === "open" ? "" : "idle"}`}>
            <i aria-hidden="true" />
            {session.status === "open" ? "진행 중" : "종료됨"}
          </span>
          <span className="small muted num">
            {fmtDateTime(session.started_at)} ~ {session.ended_at ? fmtDateTime(session.ended_at) : "진행 중"}
          </span>
        </div>
        <div className="row">
          <form action={scanSessionAction}>
            <input type="hidden" name="id" value={session.id} />
            <button type="submit" className="btn primary">경기 후보 조회</button>
          </form>
          {session.status === "open" ? (
            <form action={closeSession}>
              <input type="hidden" name="id" value={session.id} />
              <button type="submit" className="btn danger">세션 종료</button>
            </form>
          ) : null}
          <Link href="/admin/matches/new" className="btn">경기 직접 등록</Link>
        </div>
        <p className="muted small">
          후보 조회는 승인된 회원들의 이 시간대 경기를 Riot에서 찾아 아래 목록에 올립니다. 후보는 승인하기 전에는 전적에 들어가지
          않습니다. 회원이 많으면 여러 번 눌러야 할 수 있습니다. (미승인 {pending}개 확인 대기 · 승인 완료 {approved}개)
        </p>
      </section>

      <section className="stack">
        <SectionHead title={`검토할 경기 후보 ${ready.length}개`} />
        {ready.length === 0 ? (
          <div className="card"><Empty title="검토할 후보가 없습니다">경기가 끝난 뒤 &lsquo;경기 후보 조회&rsquo;를 눌러 주세요.</Empty></div>
        ) : null}
        {ready.map((c) => {
          const d = c.data!;
          const outside = d.startedAt && (new Date(d.startedAt).getTime() < startMs || (endMs !== null && new Date(d.startedAt).getTime() > endMs));
          const guess = guessMode(d.queueId, d.gameMode, d.gameType);
          return (
            <article className="card match" key={c.id}>
              <div className="match-top">
                <ModeBadge mode={guess} />
                <span className="num">{fmtDateTime(d.startedAt)}</span>
                <span className="muted small">{fmtDuration(d.durationSec)}</span>
                <span className="badge gold">회원 {c.member_matches}명 일치</span>
                {outside ? <span className="badge loss">세션 시간 밖</span> : null}
                <span className="muted small">큐 {d.queueId} · {d.gameMode}</span>
              </div>
              <div className="match-teams">
                <Players d={d} team={100} known={known} names={names} />
                <Players d={d} team={200} known={known} names={names} />
              </div>
              <div className="row">
                <form action={approveCandidate} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <select name="mode" defaultValue={guess} style={{ width: "auto" }} aria-label="게임 모드">
                    {MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select name="season_id" defaultValue={defaultSeason} style={{ width: "auto" }} aria-label="시즌">
                    <option value="">시즌 없음</option>
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button type="submit" className="btn primary small">시참 경기로 승인</button>
                </form>
                <form action={dismissCandidate} className="inline-form">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="btn small danger">시참 경기 아님</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      {dismissed.length > 0 ? (
        <section className="card">
          <details className="fold">
            <summary>제외한 후보 {dismissed.length}개</summary>
            <div className="table-wrap">
              <table style={{ minWidth: 420 }}>
                <thead><tr><th>경기</th><th>시간</th><th></th></tr></thead>
                <tbody>
                  {dismissed.map((c) => (
                    <tr key={c.id}>
                      <td className="small">{c.riot_match_id}</td>
                      <td className="num small">{fmtDateTime(c.data?.startedAt)}</td>
                      <td>
                        <form action={restoreCandidate}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn small">되돌리기</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      ) : null}
    </>
  );
}
