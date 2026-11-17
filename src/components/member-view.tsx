import Link from "next/link";
import { champLabel, type ChampNames } from "@/lib/champions";
import { fmtDate, MODE_LABEL, pctText } from "@/lib/format";
import type { MemberOverview } from "@/lib/queries";
import type { Season } from "@/lib/types";
import { Empty, SectionHead, StatGrid } from "./ui";

export function MemberView({
  overview,
  seasons,
  names,
}: {
  overview: MemberOverview;
  seasons: Season[];
  names: ChampNames;
}) {
  const { total, bySeason, byMode, champions, recent } = overview;
  const seasonName = (id: string | null) => seasons.find((s) => s.id === id)?.name ?? "시즌 없음";

  if (total.games === 0) {
    return (
      <div className="card">
        <Empty title="아직 기록된 시참 경기가 없습니다">
          방송 시참에 참여하고 관리자가 경기를 승인하면 여기에 전적이 쌓입니다.
        </Empty>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="card gilded stack">
        <SectionHead title="전체 전적" />
        <StatGrid agg={total} />
      </section>

      <section className="card stack">
        <SectionHead title="시즌별 통계" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>시즌</th><th>경기</th><th>승</th><th>패</th><th>승률</th><th>KDA</th></tr>
            </thead>
            <tbody>
              {bySeason.map((r) => (
                <tr key={String(r.seasonId)}>
                  <td>{seasonName(r.seasonId)}</td>
                  <td className="num">{r.agg.games}</td>
                  <td className="num win">{r.agg.wins}</td>
                  <td className="num loss">{r.agg.losses}</td>
                  <td className="num">{pctText(r.agg.winRate)}</td>
                  <td className="num">{r.agg.kda.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid two">
        <section className="card stack">
          <SectionHead title="게임 모드별" />
          <div className="table-wrap">
            <table style={{ minWidth: 360 }}>
              <thead><tr><th>모드</th><th>경기</th><th>승률</th><th>KDA</th></tr></thead>
              <tbody>
                {byMode.map((r) => (
                  <tr key={r.mode}>
                    <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
                    <td className="num">{r.agg.games}</td>
                    <td className="num">{pctText(r.agg.winRate)}</td>
                    <td className="num">{r.agg.kda.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card stack">
          <SectionHead title="챔피언별 성적" />
          <div className="table-wrap">
            <table style={{ minWidth: 360 }}>
              <thead><tr><th>챔피언</th><th>경기</th><th>승률</th><th>KDA</th></tr></thead>
              <tbody>
                {champions.slice(0, 15).map((r) => (
                  <tr key={r.champion}>
                    <td>{champLabel(names, r.champion)}</td>
                    <td className="num">{r.agg.games}</td>
                    <td className="num">{pctText(r.agg.winRate)}</td>
                    <td className="num">{r.agg.kda.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card stack">
        <SectionHead title="최근 참여 경기" />
        <div className="table-wrap">
          <table>
            <thead><tr><th>날짜</th><th>모드</th><th>챔피언</th><th>결과</th><th>K/D/A</th><th></th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.match_id}>
                  <td className="num">{fmtDate(r.played_at)}</td>
                  <td>{MODE_LABEL[r.mode] ?? r.mode}</td>
                  <td>{champLabel(names, r.champion)}</td>
                  <td className={r.win ? "win" : "loss"}>{r.win ? "승리" : "패배"}</td>
                  <td className="num">{r.kills}/{r.deaths}/{r.assists}</td>
                  <td><Link href={`/matches/${r.match_id}`}>보기</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
