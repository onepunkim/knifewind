import { requireAdmin } from "@/lib/auth";
import { champLabel, getChampNames } from "@/lib/champions";
import { db, fetchAll } from "@/lib/db";
import { MODE_LABEL, pctText } from "@/lib/format";
import { getSeasons } from "@/lib/queries";
import { sumRows } from "@/lib/stats";
import type { ChampStatRow } from "@/lib/types";
import { Empty, SectionHead } from "@/components/ui";

export const metadata = { title: "통계 관리" };
export const dynamic = "force-dynamic";

export default async function AdminStats() {
  await requireAdmin();
  const [seasons, names] = await Promise.all([getSeasons(), getChampNames()]);

  const matches = await fetchAll<{ season_id: string | null; mode: string; source: string; status: string }>((from, to) =>
    db().from("matches").select("season_id, mode, source, status").order("played_at").range(from, to),
  );
  const approved = matches.filter((m) => m.status === "approved");
  const cancelled = matches.length - approved.length;

  const count = (key: (m: (typeof matches)[number]) => string) => {
    const map = new Map<string, number>();
    approved.forEach((m) => map.set(key(m), (map.get(key(m)) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  };
  const bySeason = count((m) => m.season_id ?? "none");
  const byMode = count((m) => m.mode);
  const bySource = count((m) => m.source);

  const champRows = await fetchAll<ChampStatRow>((from, to) =>
    db().from("v_member_champion_stats").select("*").order("champion").order("member_id").order("season_id").range(from, to),
  );
  const byChamp = new Map<string, ChampStatRow[]>();
  champRows.forEach((r) => byChamp.set(r.champion, [...(byChamp.get(r.champion) ?? []), r]));
  const champs = Array.from(byChamp.entries())
    .map(([champion, list]) => ({ champion, agg: sumRows(list) }))
    .sort((a, b) => b.agg.games - a.agg.games)
    .slice(0, 15);

  const seasonName = (id: string) => (id === "none" ? "시즌 없음" : seasons.find((s) => s.id === id)?.name ?? "삭제된 시즌");

  return (
    <>
      <SectionHead title="통계" />
      <p className="muted small">
        회원 전적과 랭킹은 승인된 경기에서 자동으로 계산됩니다. 별도로 다시 계산할 필요가 없고, 경기를 수정하거나 승인 취소하면 즉시
        반영됩니다. 이 화면은 운영 현황을 확인하는 용도입니다.
      </p>
      <div className="grid three">
        <section className="card stack">
          <h3>시즌별 경기 수</h3>
          {bySeason.length === 0 ? <Empty title="기록 없음" /> : (
            <table style={{ minWidth: 0 }}><tbody>
              {bySeason.map(([k, v]) => <tr key={k}><td>{seasonName(k)}</td><td className="num">{v}</td></tr>)}
            </tbody></table>
          )}
        </section>
        <section className="card stack">
          <h3>모드별 경기 수</h3>
          {byMode.length === 0 ? <Empty title="기록 없음" /> : (
            <table style={{ minWidth: 0 }}><tbody>
              {byMode.map(([k, v]) => <tr key={k}><td>{MODE_LABEL[k] ?? k}</td><td className="num">{v}</td></tr>)}
            </tbody></table>
          )}
        </section>
        <section className="card stack">
          <h3>등록 방식</h3>
          <table style={{ minWidth: 0 }}><tbody>
            {bySource.map(([k, v]) => <tr key={k}><td>{k === "manual" ? "직접 등록" : "Riot 조회"}</td><td className="num">{v}</td></tr>)}
            <tr><td>승인 취소됨</td><td className="num">{cancelled}</td></tr>
          </tbody></table>
        </section>
      </div>

      <section className="card stack">
        <h3>많이 플레이된 챔피언 (회원 기준)</h3>
        {champs.length === 0 ? <Empty title="기록 없음" /> : (
          <div className="table-wrap">
            <table style={{ minWidth: 360 }}>
              <thead><tr><th>챔피언</th><th>경기</th><th>승률</th><th>KDA</th></tr></thead>
              <tbody>
                {champs.map((c) => (
                  <tr key={c.champion}>
                    <td>{champLabel(names, c.champion)}</td>
                    <td className="num">{c.agg.games}</td>
                    <td className="num">{pctText(c.agg.winRate)}</td>
                    <td className="num">{c.agg.kda.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
