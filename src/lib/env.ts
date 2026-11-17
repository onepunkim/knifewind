export function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `환경 변수 ${name} 가 설정되지 않았습니다. 설치 안내서의 환경 변수 단계를 확인해 주세요.`,
    );
  }
  return v;
}

export function opt(name: string): string | undefined {
  const v = process.env[name];
  return v ? v : undefined;
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function adminChannelIds(): string[] {
  return (process.env.ADMIN_CHZZK_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
