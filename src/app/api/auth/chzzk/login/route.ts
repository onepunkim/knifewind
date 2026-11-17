import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/chzzk";
import { cookieOptions, STATE_COOKIE } from "@/lib/session";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const res = NextResponse.redirect(buildAuthUrl(state));
    res.cookies.set(STATE_COOKIE, state, cookieOptions(600));
    return res;
  } catch (e) {
    console.error("[auth] 로그인 시작 실패", e);
    const msg = encodeURIComponent("로그인 설정이 아직 끝나지 않았습니다. 관리자에게 알려 주세요.");
    return NextResponse.redirect(new URL(`/login?err=${msg}`, siteUrl()));
  }
}
