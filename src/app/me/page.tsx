import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getChampNames } from "@/lib/champions";
import { fmtDate, riotIdText } from "@/lib/format";
import { getMemberOverview, getSeasons } from "@/lib/queries";
import { MemberView } from "@/components/member-view";
import { Flash, SectionHead, str } from "@/components/ui";

export const metadata = { title: "마이페이지" };
export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, string> = {
  incomplete: "가입 신청 전",
  pending: "승인 대기 중",
  approved: "정식 회원",
  rejected: "가입 거절됨",
};

export default async function MePage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const me = await requireMember();
  const [overview, seasons, names] = await Promise.all([getMemberOverview(me.id), getSeasons(), getChampNames()]);

  return (
    <main className="container">
      <SectionHead title="마이페이지" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      <section className="card gilded stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "1.4rem" }}>{me.chzzk_name}</h2>
          <span className={`badge ${me.status === "approved" ? "win" : "gold"}`}>{STATUS_TEXT[me.status] ?? me.status}</span>
        </div>
        <div className="stats">
          <div className="stat"><b style={{ fontSize: "1.05rem", overflowWrap: "anywhere" }}>{me.chzzk_name}</b><span>치지직 닉네임</span></div>
          <div className="stat"><b style={{ fontSize: "1.05rem", overflowWrap: "anywhere" }}>{riotIdText(me.riot_game_name, me.riot_tag_line)}</b><span>Riot ID</span></div>
          <div className="stat"><b style={{ fontSize: "1.05rem" }}>{fmtDate(me.created_at)}</b><span>가입일</span></div>
        </div>

        {me.status === "incomplete" ? (
          <div className="flash info">
            Riot ID를 입력해야 가입 신청이 접수됩니다. <Link href="/join">Riot ID 입력하기</Link>
          </div>
        ) : null}
        {me.status === "pending" ? (
          <div className="flash info">
            관리자가 확인하고 있습니다. 승인되면 방송 시참 경기가 전적에 반영됩니다. Riot ID를 잘못 적었다면{" "}
            <Link href="/join">다시 입력</Link>할 수 있습니다.
          </div>
        ) : null}
        {me.status === "rejected" ? (
          <div className="flash err">
            가입이 거절되었습니다.{me.reject_reason ? ` 사유: ${me.reject_reason}.` : ""} <Link href="/join">Riot ID를 고쳐 다시 신청</Link>할 수 있습니다.
          </div>
        ) : null}
      </section>

      <MemberView overview={overview} seasons={seasons} names={names} />
    </main>
  );
}
