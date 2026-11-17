import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { cookieOptions, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.redirect(new URL("/", siteUrl()), 303);
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
