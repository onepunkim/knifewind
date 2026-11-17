import { getRankedAgg, getSeasons, resolveSeason } from "@/lib/queries";
import { buildBoards } from "@/lib/stats";
import { Empty, MemberLink, SeasonFilter, SectionHead, str } from "@/components/ui";

export const metadata = { title: "명예의 전당" };
export const dynamic = "force-dynamic";

const MIN_GAMES = 5; // 승률·KDA 순위에 올라가기 위한 최소 참여 경기 수

export default async function HallOfFamePage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const seasons = await getSeasons();
  const { id: seasonId, season } = await resolveSeason(str(searchParams.season));
  const { byMember, members } = await getRankedAgg(seasonId);
  const boards = buildBoards(byMember, MIN_GAMES);
  const selected = seasonId ?? "all";

  return (
    <main className="container">
      <SectionHead title="명예의 전당">
        <SeasonFilter seasons={seasons} value={selected} action="/hall-of-fame" />
      </SectionHead>
      <p className="muted small">
        {season ? `${season.name} 기준` : "전체 시즌 기준"} · 승인된 시참 경기만 집계합니다. 승률과 KDA는 {MIN_GAMES}판 이상 참여한 회원만 올라갑니다.
      </p>

      {byMember.size === 0 ? (
        <div className="card"><Empty title="아직 집계할 기록이 없습니다">시참 경기가 승인되면 순위가 나타납니다.</Empty></div>
      ) : (
        <div className="grid three">
          {boards.map((b) => (
            <section className="card gilded stack" key={b.key}>
              <div>
                <h3>{b.title}</h3>
                <p className="muted small">{b.note}</p>
              </div>
              {b.entries.length === 0 ? (
                <p className="muted small">조건을 채운 회원이 아직 없습니다.</p>
              ) : (
                <ol className="board-list">
                  {b.entries.map((e, i) => (
                    <li key={e.memberId}>
                      <span className="rank">{i + 1}</span>
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                        <MemberLink id={e.memberId} name={members.get(e.memberId)?.chzzk_name ?? "회원"} />
                        <span className="muted small"> · {e.sub}</span>
                      </span>
                      <span className="val">{e.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
