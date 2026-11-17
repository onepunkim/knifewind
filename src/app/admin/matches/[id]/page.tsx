import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { champLabel, getChampNames } from "@/lib/champions";
import { isoToKstInput, MODE_OPTIONS } from "@/lib/format";
import { getMatch, getParticipants, getSeasons } from "@/lib/queries";
import { deleteMatch, setMatchStatus, updateMatch } from "@/app/actions/admin";
import { MatchCard } from "@/components/match";
import { Flash, SectionHead, TeamBadge, str } from "@/components/ui";

export const metadata = { title: "경기 수정" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminMatchPage({
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
  const match = await getMatch(params.id, true);
  if (!match) notFound();
  const [partsMap, names, seasons] = await Promise.all([getParticipants([match!.id]), getChampNames(), getSeasons()]);
  const parts = partsMap.get(match!.id) ?? [];
  const m = match!;

  return (
    <>
      <SectionHead title="경기 수정">
        <Link href="/admin/matches" className="small">← 경기 목록</Link>
      </SectionHead>
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />
      <MatchCard match={m} parts={parts} names={names} admin />

      <form action={updateMatch} className="card stack">
        <input type="hidden" name="id" value={m.id} />
        <h3>기록 고치기</h3>
        <div className="form-grid">
          <label className="field">경기 시작 시간(한국 시간)<input type="datetime-local" name="played_at" defaultValue={isoToKstInput(m.played_at)} required /></label>
          <label className="field">게임 모드
            <select name="mode" defaultValue={m.mode}>
              {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field">이긴 팀
            <select name="winning_team" defaultValue={m.winning_team ? String(m.winning_team) : ""}>
              <option value="">미정</option>
              <option value="100">블루팀</option>
              <option value="200">레드팀</option>
            </select>
          </label>
          <label className="field">시즌
            <select name="season_id" defaultValue={m.season_id ?? ""}>
              <option value="">시즌 없음</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">진행 시간(분)<input type="number" name="duration_min" min={1} max={180} defaultValue={m.duration_seconds ? Math.round(m.duration_seconds / 60) : ""} /></label>
          <label className="field">메모<input type="text" name="note" maxLength={300} defaultValue={m.note ?? ""} /></label>
        </div>
        {([100, 200] as const).map((team) => (
          <div className="stack" key={team}>
            <h3><TeamBadge team={team} /></h3>
            {parts.filter((p) => p.team_id === team).map((p) => (
              <div className="prow" key={p.id}>
                <input type="text" value={p.members?.chzzk_name ? `${p.members.chzzk_name} (${p.riot_name})` : p.riot_name} readOnly aria-label="참가자" />
                <input type="text" name={`c_${p.id}`} defaultValue={p.champion} placeholder={champLabel(names, p.champion)} aria-label="챔피언" />
                <input type="number" name={`k_${p.id}`} defaultValue={p.kills} min={0} max={999} aria-label="킬" />
                <input type="number" name={`d_${p.id}`} defaultValue={p.deaths} min={0} max={999} aria-label="데스" />
                <input type="number" name={`a_${p.id}`} defaultValue={p.assists} min={0} max={999} aria-label="어시스트" />
              </div>
            ))}
          </div>
        ))}
        <p className="muted small">챔피언은 한글 이름이나 영문 이름 모두 입력할 수 있습니다. 이긴 팀을 바꾸면 참가자의 승패가 함께 바뀝니다.</p>
        <div className="row"><button type="submit" className="btn primary">저장</button></div>
      </form>

      <section className="card stack">
        <h3>승인 상태</h3>
        <div className="row">
          <form action={setMatchStatus}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="status" value={m.status === "approved" ? "cancelled" : "approved"} />
            <button type="submit" className="btn">{m.status === "approved" ? "승인 취소 (통계에서 제외)" : "다시 승인 (통계에 포함)"}</button>
          </form>
        </div>
        <details className="fold">
          <summary>경기 삭제</summary>
          <p className="muted small">삭제하면 되돌릴 수 없습니다. Riot에서 조회한 경기는 삭제 후 후보 목록으로 돌아가 다시 검토할 수 있습니다.</p>
          <form action={deleteMatch}>
            <input type="hidden" name="id" value={m.id} />
            <button type="submit" className="btn danger">정말 삭제합니다</button>
          </form>
        </details>
      </section>
    </>
  );
}
