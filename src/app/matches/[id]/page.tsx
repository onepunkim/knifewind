import Link from "next/link";
import { notFound } from "next/navigation";
import { getChampNames } from "@/lib/champions";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { getMatch, getParticipants, getSeasons } from "@/lib/queries";
import { MatchCard } from "@/components/match";
import { SectionHead } from "@/components/ui";

export const metadata = { title: "경기 상세" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MatchDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!UUID.test(params.id)) notFound();
  const match = await getMatch(params.id, false);
  if (!match) notFound();
  const [parts, names, seasons] = await Promise.all([getParticipants([match!.id]), getChampNames(), getSeasons()]);
  const season = seasons.find((s) => s.id === match!.season_id);

  return (
    <main className="container">
      <SectionHead title="경기 상세">
        <Link href="/matches" className="small">← 경기 기록</Link>
      </SectionHead>
      <MatchCard match={match!} parts={parts.get(match!.id) ?? []} names={names} />
      <section className="card">
        <div className="stats">
          <div className="stat"><b>{fmtDateTime(match!.played_at)}</b><span>경기 시작</span></div>
          <div className="stat"><b>{fmtDuration(match!.duration_seconds)}</b><span>진행 시간</span></div>
          <div className="stat"><b>{season?.name ?? "-"}</b><span>시즌</span></div>
        </div>
      </section>
    </main>
  );
}
