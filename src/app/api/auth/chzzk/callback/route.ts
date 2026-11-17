import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchMe } from "@/lib/chzzk";
import { db } from "@/lib/db";
import { adminChannelIds, siteUrl } from "@/lib/env";
import { cookieOptions, SESSION_COOKIE, sessionCookieOptions, signSession, STATE_COOKIE } from "@/lib/session";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

function back(path: string, err?: string) {
  const url = new URL(path, siteUrl());
  if (err) url.searchParams.set("err", err);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, "", cookieOptions(0));
  return res;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const saved = req.cookies.get(STATE_COOKIE)?.value;

  if (params.get("error")) return back("/login", "치지직 로그인이 취소되었습니다.");
  if (!code || !state || !saved || state !== saved) {
    return back("/login", "로그인 확인에 실패했습니다. 다시 시도해 주세요.");
  }

  try {
    const token = await exchangeCode(code, state);
    const me = await fetchMe(token);

    const { data: found, error: findErr } = await db()
      .from("members")
      .select("*")
      .eq("chzzk_channel_id", me.channelId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    const isAdmin = adminChannelIds().includes(me.channelId);
    let member = found as Member | null;
    const now = new Date().toISOString();

    if (!member) {
      const { data, error } = await db()
        .from("members")
        .insert({
          chzzk_channel_id: me.channelId,
          chzzk_name: me.channelName,
          role: isAdmin ? "admin" : "member",
          status: isAdmin ? "approved" : "incomplete",
          approved_at: isAdmin ? now : null,
          last_login_at: now,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      member = data as Member;
    } else {
      if (member.status === "banned") return back("/login", "이용이 제한된 계정입니다.");
      const patch: Record<string, unknown> = { chzzk_name: me.channelName, last_login_at: now };
      if (isAdmin && (member.role !== "admin" || member.status !== "approved")) {
        patch.role = "admin";
        patch.status = "approved";
        patch.approved_at = now;
      }
      const { data, error } = await db().from("members").update(patch).eq("id", member.id).select("*").single();
      if (error) throw new Error(error.message);
      member = data as Member;
    }

    const next = member.status === "incomplete" ? "/join" : "/me";
    const res = NextResponse.redirect(new URL(next, siteUrl()));
    res.cookies.set(SESSION_COOKIE, await signSession(member.id), sessionCookieOptions());
    res.cookies.set(STATE_COOKIE, "", cookieOptions(0));
    return res;
  } catch (e) {
    console.error("[auth] 치지직 로그인 처리 실패", e);
    return back("/login", "치지직 로그인 처리 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.");
  }
}
