import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { countMatches, countMembers, getOpenSession } from "@/lib/queries";
import { SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const [pending, approved, matches, open, ready] = await Promise.all([
    countMembers("pending"),
    countMembers("approved"),
    countMatches(),
    getOpenSession(),
    db().from("match_candidates").select("id", { count: "exact", head: true }).eq("status", "ready"),
  ]);

  return (
    <>
      <section className="card gilded stack">
        <SectionHead title="지금 할 일" />
        <div className="stats">
          <Link href="/admin/members?status=pending" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
            <b className="num">{pending}</b><span>승인 대기 회원</span>
          </Link>
          <Link href="/admin/sessions" className="stat" style={{ textDecoration: "none", color: "inherit" }}>
            <b className="num">{ready.count ?? 0}</b><span>검토할 경기 후보</span>
          </Link>
          <Link href={open ? `/admin/sessions/${open.id}` : "/admin/sessions"} className="stat" style={{ textDecoration: "none", color: "inherit" }}>
            <b>{open ? "진행 중" : "없음"}</b><span>시참 세션</span>
          </Link>
          <div className="stat"><b className="num">{approved}</b><span>승인 회원</span></div>
          <div className="stat"><b className="num">{matches}</b><span>승인된 경기</span></div>
        </div>
      </section>

      <section className="card stack">
        <SectionHead title="방송 때 순서" />
        <ol className="stack small" style={{ margin: 0, paddingLeft: 18, color: "var(--silver)" }}>
          <li>방송을 시작하면 <Link href="/admin/sessions">시참 세션</Link>을 시작합니다.</li>
          <li>시참 경기가 몇 판 끝나면 세션 화면에서 &lsquo;경기 후보 조회&rsquo;를 누릅니다.</li>
          <li>후보 경기의 참가자와 시간을 보고 실제 시참 경기만 &lsquo;승인&rsquo;합니다.</li>
          <li>방송이 끝나면 세션을 종료하고, 한 번 더 후보 조회로 빠진 경기가 없는지 확인합니다.</li>
          <li>Riot에서 찾을 수 없는 경기(사용자 설정 내전 등)는 <Link href="/admin/matches/new">직접 등록</Link>합니다.</li>
        </ol>
      </section>
    </>
  );
}
