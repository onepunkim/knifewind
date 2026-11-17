import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isoToKstInput, MODE_OPTIONS } from "@/lib/format";
import { getSeasons } from "@/lib/queries";
import { createManualMatch } from "@/app/actions/admin";
import { Flash, SectionHead, str } from "@/components/ui";

export const metadata = { title: "경기 직접 등록" };
export const dynamic = "force-dynamic";

export default async function NewMatchPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  const seasons = await getSeasons();
  const { data } = await db()
    .from("members")
    .select("chzzk_name, riot_game_name, riot_tag_line")
    .eq("status", "approved")
    .not("riot_game_name", "is", null)
    .order("chzzk_name")
    .limit(500);
  const members = (data ?? []) as { chzzk_name: string; riot_game_name: string; riot_tag_line: string }[];
  const nowInput = isoToKstInput(new Date().toISOString());
  const current = seasons.find((s) => s.is_current);

  const side = (team: 100 | 200, label: string) => (
    <div className="stack">
      <h3>{label}</h3>
      {Array.from({ length: 5 }, (_, i) => (
        <div className="prow" key={i}>
          <input type="text" name={`n_${team}_${i}`} list="member-list" placeholder="Riot ID 또는 이름" aria-label={`${label} ${i + 1} 이름`} autoComplete="off" />
          <input type="text" name={`c_${team}_${i}`} placeholder="챔피언" aria-label={`${label} ${i + 1} 챔피언`} autoComplete="off" />
          <input type="number" name={`k_${team}_${i}`} min={0} max={999} placeholder="K" aria-label="킬" inputMode="numeric" />
          <input type="number" name={`d_${team}_${i}`} min={0} max={999} placeholder="D" aria-label="데스" inputMode="numeric" />
          <input type="number" name={`a_${team}_${i}`} min={0} max={999} placeholder="A" aria-label="어시스트" inputMode="numeric" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <SectionHead title="경기 직접 등록" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />
      <p className="muted small">
        Riot에서 자동으로 찾을 수 없는 경기(사용자 설정 내전, 증바람 등)를 손으로 입력합니다. 회원의 Riot ID(이름#태그) 또는
        치지직 닉네임을 정확히 입력하면 그 회원의 전적에 연결되고, 그렇지 않으면 비회원 참가자로 기록됩니다.
      </p>
      <form action={createManualMatch} className="card gilded stack">
        <div className="form-grid">
          <label className="field">경기 시작 시간(한국 시간)<input type="datetime-local" name="played_at" defaultValue={nowInput} required /></label>
          <label className="field">게임 모드
            <select name="mode" defaultValue="custom">
              {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="field">이긴 팀
            <select name="winning_team" defaultValue="" required>
              <option value="" disabled>선택</option>
              <option value="100">블루팀</option>
              <option value="200">레드팀</option>
            </select>
          </label>
          <label className="field">시즌
            <select name="season_id" defaultValue={current?.id ?? ""}>
              <option value="">시즌 없음</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">진행 시간(분, 선택)<input type="number" name="duration_min" min={1} max={180} inputMode="numeric" /></label>
          <label className="field">메모(선택)<input type="text" name="note" maxLength={300} /></label>
        </div>
        <div className="grid two">
          {side(100, "블루팀")}
          {side(200, "레드팀")}
        </div>
        <datalist id="member-list">
          {members.map((m) => (
            <option key={`${m.riot_game_name}#${m.riot_tag_line}`} value={`${m.riot_game_name}#${m.riot_tag_line}`}>{m.chzzk_name}</option>
          ))}
        </datalist>
        <div className="row"><button type="submit" className="btn primary">경기 등록</button></div>
      </form>
    </>
  );
}
