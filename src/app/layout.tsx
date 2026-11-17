import "./globals.css";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getCurrentMember } from "@/lib/auth";
import type { Member } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "칼바람 나락 | KNIFEWIND 1PUN", template: "%s | 칼바람 나락" },
  description: "방송 시청자 참여 칼바람 나락 경기의 전적과 시즌 랭킹을 기록하는 커뮤니티",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060b16",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  let me: Member | null = null;
  try {
    me = await getCurrentMember();
  } catch {
    me = null; // 환경 설정 전이라도 화면은 열리게 합니다
  }
  const isAdmin = me?.role === "admin" && me.status === "approved";

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
        />
      </head>
      <body>
        <div className="page-wrap">
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="brand" aria-label="칼바람 나락 홈">
                <span className="brand-mark" aria-hidden="true" />
                <span className="brand-text">
                  <span className="brand-en">KNIFEWIND <b>1PUN</b></span>
                  <span className="brand-ko">칼바람 나락</span>
                </span>
              </Link>
              <nav className="nav" aria-label="주 메뉴">
                <Link href="/">홈</Link>
                <Link href="/matches">경기 기록</Link>
                <Link href="/hall-of-fame">명예의 전당</Link>
                <Link href="/me">마이페이지</Link>
                {isAdmin ? <Link href="/admin" className="admin">관리자</Link> : null}
              </nav>
              <div className="userbox">
                {me ? (
                  <>
                    <span className="who">{me.chzzk_name}</span>
                    <form action="/api/auth/logout" method="post">
                      <button type="submit" className="btn small">로그아웃</button>
                    </form>
                  </>
                ) : (
                  <Link href="/login" className="btn small primary">치지직 로그인</Link>
                )}
              </div>
            </div>
          </header>
          {children}
          <footer className="site-footer">
            <div className="container">
              KNIFEWIND 1PUN은 방송 시청자 참여 경기를 기록하는 팬 커뮤니티 사이트이며, Riot Games의 후원이나 보증을 받지 않았고
              Riot Games 또는 Riot Games 서비스 운영에 공식적으로 관여하는 누구의 견해도 반영하지 않습니다. Riot Games 및 관련
              모든 자산은 Riot Games, Inc.의 상표 또는 등록 상표입니다. 치지직(CHZZK)은 NAVER의 서비스입니다.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
