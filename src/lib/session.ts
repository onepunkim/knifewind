import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { need } from "./env";

export const SESSION_COOKIE = "kw_session";
export const STATE_COOKIE = "kw_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

function secretKey(): Uint8Array {
  const s = need("SESSION_SECRET");
  if (s.length < 32) throw new Error("SESSION_SECRET 은 32자 이상이어야 합니다.");
  return new TextEncoder().encode(s);
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** 로그인 쿠키 값(서명된 토큰)을 만듭니다. 쿠키에는 회원 ID만 들어갑니다. */
export async function signSession(memberId: string): Promise<string> {
  return await new SignJWT({ mid: memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export const sessionCookieOptions = () => cookieOptions(MAX_AGE);

export async function readSessionMemberId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.mid === "string" ? payload.mid : null;
  } catch {
    return null;
  }
}
