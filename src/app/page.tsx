import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { getChampNames } from "@/lib/champions";
import { fmtDate, fmtDateTime } from "@/lib/format";
import {
  countMatches,
  getAnnouncements,
  getCurrentSeason,
  getMatches,
  getOpenSession,
  getParticipants,
  getRankedAgg,
} from "@/lib/queries";
import { sortByWins } from "@/lib/stats";
import { MatchCard } from "@/components/match";
import { Empty, MemberLink, SectionHead } from "@/components/ui";
import { pctText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const me = await getCurrentMember().catch(() => null);
  const [openSession, season, notices] = await Promise.all([getOpenSession(), getCurrentSeason(), getAnnouncements(4)]);
  const seasonId = season?.id ?? null;
  const [recent, ranked, matchCount, names] = await Promise.all([
    getMatches({ page: 1, pageSize: 3 }),
    getRankedAgg(seasonId),
    countMatches(seasonId),
    getChampNames(),
  ]);
  const parts = await getParticipants(recent.rows.map((m) => m.id));
  const top = sortByWins(Array.from(ranked.byMember.entries()).map(([memberId, agg]) => ({ memberId, agg }))).slice(0, 5);

  return (
    <main className="container">
      <section className="hero">
        <span className="kicker">KNIFEWIND 1PUN</span>
        <h1>
          칼바람 나락,<br />
          <em>시청자와 함께한 모든 판</em>
        </h1>
        <p>
          방송에서 시청자와 같이 플레이한 칼바람 나락 경기만 모아 전적과 시즌 랭킹으로 보여 줍니다. 개인적으로 한 판은 기록되지
          않고, 관리자가 확인한 시참 경기만 올라갑니다.
        </p>
        <span className={`live ${openSession ? "" : "idle"}`}>
          <i aria-hidden="true" />
          {openSession ? `시참 진행 중 · ${openSession.title}` : "지금은 시참 진행 중이 아닙니다"}
        </span>
        <div className="row">
          {me ? (
            <Link className="btn primary" href="/me">내 전적 보기</Link>
          ) : (
            <Link className="btn primary" href="/login">치지직으로 시작하기</Link>
          )}
          <Link className="btn" href="/matches">경기 기록</Link>
          <Link className="btn gold" href="/hall-of-fame">명예의 전당</Link>
        </div>
      </section>

      <div className="grid two">
        <section className="card gilded stack">
          <SectionHead title="현재 시즌" />
          {season ? (
            <>
              <h3 style={{ fontSize: "1.3rem" }}>{season.name}</h3>
              <p className="muted small">
                {fmtDate(season.starts_on)} 시작{season.ends_on ? ` · ${fmtDate(season.ends_on)} 종료` : ""}
              </p>
              <div className="stats">
                <div className="stat"><b className="num">{matchCount}</b><span>승인된 경기</span></div>
                <div className="stat"><b className="num">{ranked.byMember.size}</b><span>참여 회원</span></div>
              </div>
            </>
          ) : (
            <p className="muted">진행 중인 시즌이 없습니다.</p>
          )}
        </section>

        <section className="card stack">
          <SectionHead title="참여 방법" />
          <ol className="stack small" style={{ margin: 0, paddingLeft: 18, color: "var(--silver)" }}>
            <li>치지직 계정으로 로그인합니다.</li>
            <li>시참에서 쓰는 롤 계정의 Riot ID를 입력해 가입을 신청합니다.</li>
            <li>관리자가 확인해 승인하면 정식 회원이 됩니다.</li>
            <li>방송 시참 경기가 끝나면 관리자가 승인한 판만 전적에 반영됩니다.</li>
          </ol>
        </section>
      </div>

      <section>
        <SectionHead title="최근 시참 경기">
          <Link href="/matches" className="small">전체 보기</Link>
        </SectionHead>
        {recent.rows.length === 0 ? (
          <div className="card"><Empty title="아직 기록된 경기가 없습니다">첫 시참 경기가 승인되면 이곳에 나타납니다.</Empty></div>
        ) : (
          recent.rows.map((m) => (
            <MatchCard key={m.id} match={m} parts={parts.get(m.id) ?? []} names={names} href={`/matches/${m.id}`} />
          ))
        )}
      </section>

      <div className="grid two">
        <section className="card stack">
          <SectionHead title="시즌 랭킹 미리보기">
            <Link href="/hall-of-fame" className="small">명예의 전당</Link>
          </SectionHead>
          {top.length === 0 ? (
            <Empty title="집계할 기록이 없습니다" />
          ) : (
            <div className="table-wrap">
              <table style={{ minWidth: 320 }}>
                <thead><tr><th>#</th><th>회원</th><th>승</th><th>승률</th></tr></thead>
                <tbody>
                  {top.map((e, i) => (
                    <tr key={e.memberId}>
                      <td className="rank">{i + 1}</td>
                      <td><MemberLink id={e.memberId} name={ranked.members.get(e.memberId)?.chzzk_name ?? "회원"} /></td>
                      <td className="num win">{e.agg.wins}</td>
                      <td className="num">{pctText(e.agg.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">승리 수, 승률 순으로 정렬합니다.</p>
        </section>

        <section className="card stack">
          <SectionHead title="공지사항" />
          {notices.length === 0 ? (
            <Empty title="등록된 공지가 없습니다" />
          ) : (
            <div>
              {notices.map((n) => (
                <div className="notice-item" key={n.id}>
                  <div className="row">
                    {n.pinned ? <span className="badge gold">고정</span> : null}
                    <b>{n.title}</b>
                    <span className="muted small">{fmtDateTime(n.created_at)}</span>
                  </div>
                  {n.body ? <p className="body small">{n.body}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
