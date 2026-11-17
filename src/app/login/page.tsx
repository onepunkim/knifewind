import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { Flash, str } from "@/components/ui";

export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const me = await getCurrentMember().catch(() => null);
  if (me) redirect(me.status === "incomplete" ? "/join" : "/me");

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div className="card gilded stack">
        <h1 style={{ fontSize: "1.6rem" }}>치지직으로 로그인</h1>
        <p className="muted">
          별도의 비밀번호 없이 치지직 계정으로 가입하고 로그인합니다. 가입 신청 후 Riot ID를 입력하면 관리자가 확인한 뒤
          승인합니다. 승인된 회원만 시참 전적과 랭킹에 기록됩니다.
        </p>
        <Flash err={str(searchParams.err)} />
        <div className="row">
          <a className="btn primary" href="/api/auth/chzzk/login">치지직으로 계속하기</a>
        </div>
        <p className="muted small">
          이 사이트는 치지직 닉네임과 채널 ID만 가져옵니다. 치지직 비밀번호는 사이트가 알 수 없습니다.
        </p>
      </div>
    </main>
  );
}
