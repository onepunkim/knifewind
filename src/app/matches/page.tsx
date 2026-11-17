import { getChampNames } from "@/lib/champions";
import { MODE_OPTIONS } from "@/lib/format";
import { getMatches, getParticipants, getSeasons } from "@/lib/queries";
import { MatchCard } from "@/components/match";
import { Empty, Pager, SectionHead, str } from "@/components/ui";

export const metadata = { title: "경기 기록" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function MatchesPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const mode = str(searchParams.mode) || undefined;
  const season = str(searchParams.season) || undefined;
  const from = str(searchParams.from) || undefined;
  const to = str(searchParams.to) || undefined;
  const page = Math.max(1, parseInt(str(searchParams.page) ?? "1", 10) || 1);

  const seasons = await getSeasons();
  const { rows, total } = await getMatches({ mode, seasonId: season, from, to, page, pageSize: PAGE_SIZE });
  const [parts, names] = await Promise.all([getParticipants(rows.map((m) => m.id)), getChampNames()]);

  return (
    <main className="container">
      <SectionHead title="경기 기록">
        <span className="muted small num">총 {total}경기</span>
      </SectionHead>

      <form method="get" className="card form-grid" style={{ alignItems: "end" }}>
        <label className="field">
          게임 모드
          <select name="mode" defaultValue={mode ?? ""}>
            <option value="">전체</option>
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          시즌
          <select name="season" defaultValue={season ?? ""}>
            <option value="">전체</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          시작 날짜
          <input type="date" name="from" defaultValue={from ?? ""} />
        </label>
        <label className="field">
          끝 날짜
          <input type="date" name="to" defaultValue={to ?? ""} />
        </label>
        <div className="row">
          <button type="submit" className="btn primary">검색</button>
          <a className="btn" href="/matches">초기화</a>
        </div>
      </form>

      <section>
        {rows.length === 0 ? (
          <div className="card"><Empty title="조건에 맞는 경기가 없습니다">검색 조건을 바꿔 보세요.</Empty></div>
        ) : (
          rows.map((m) => (
            <MatchCard key={m.id} match={m} parts={parts.get(m.id) ?? []} names={names} href={`/matches/${m.id}`} />
          ))
        )}
        <Pager basePath="/matches" params={{ mode, season, from, to }} page={page} total={total} pageSize={PAGE_SIZE} />
      </section>
    </main>
  );
}
