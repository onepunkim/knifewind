import { need, siteUrl } from "./env";

// 치지직 오픈 API 로그인(OAuth). 공식 문서: https://chzzk.gitbook.io/chzzk
// 인증 흐름과 요청 모양은 바뀔 수 있으므로, 로그인이 실패하면 서버 로그에 남는 오류 내용을 먼저 확인합니다.
const AUTH_URL = "https://chzzk.naver.com/account-interlock";
const TOKEN_URL = "https://openapi.chzzk.naver.com/auth/v1/token";
const ME_URL = "https://openapi.chzzk.naver.com/open/v1/users/me";

export function redirectUri(): string {
  return `${siteUrl()}/api/auth/chzzk/callback`;
}

export function buildAuthUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    clientId: need("CHZZK_CLIENT_ID"),
    redirectUri: redirectUri(),
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** 로그인 후 돌아온 code 를 사용자 정보 조회용 액세스 토큰으로 바꿉니다. */
export async function exchangeCode(code: string, state: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      clientId: need("CHZZK_CLIENT_ID"),
      clientSecret: need("CHZZK_CLIENT_SECRET"),
      code,
      state,
      redirectUri: redirectUri(),
    }),
    cache: "no-store",
  });
  const json = await readJson(res);
  const token = json?.content?.accessToken;
  if (!res.ok || typeof token !== "string") {
    console.error("[chzzk] 토큰 발급 실패", res.status, JSON.stringify(json).slice(0, 500));
    throw new Error("치지직 토큰 발급에 실패했습니다.");
  }
  return token;
}

export type ChzzkUser = { channelId: string; channelName: string };

export async function fetchMe(accessToken: string): Promise<ChzzkUser> {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await readJson(res);
  const c = json?.content;
  if (!res.ok || typeof c?.channelId !== "string") {
    console.error("[chzzk] 사용자 정보 조회 실패", res.status, JSON.stringify(json).slice(0, 500));
    throw new Error("치지직 사용자 정보를 가져오지 못했습니다.");
  }
  return { channelId: c.channelId, channelName: String(c.channelName ?? "이름 없음") };
}
