import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <main className="container">
      <div className="stack">
        <h1 style={{ fontSize: "1.6rem" }}>관리자</h1>
        <nav className="subnav" aria-label="관리자 메뉴">
          <Link href="/admin">요약</Link>
          <Link href="/admin/members">회원</Link>
          <Link href="/admin/sessions">시참 세션</Link>
          <Link href="/admin/matches">경기 기록</Link>
          <Link href="/admin/seasons">시즌</Link>
          <Link href="/admin/announcements">공지사항</Link>
          <Link href="/admin/stats">통계</Link>
        </nav>
      </div>
      {children}
    </main>
  );
}
