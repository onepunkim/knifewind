import { requireMember } from "@/lib/auth";
import { submitRiotId } from "@/app/actions/member";
import { Flash, str } from "@/components/ui";
import { riotIdText } from "@/lib/format";

export const metadata = { title: "가입 신청" };

export default async function JoinPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const me = await requireMember();
  const current = riotIdText(me.riot_game_name, me.riot_tag_line);

  return (
    <main className="container" style={{ maxWidth: 600 }}>
      <div className="card gilded stack">
        <h1 style={{ fontSize: "1.6rem" }}>가입 신청</h1>
        <p className="muted">
          <b>{me.chzzk_name}</b> 님, 시참에서 쓰는 롤 계정의 Riot ID를 입력해 주세요. 게임 안의 소환사 이름과 태그(#뒤 글자)를
          그대로 적으면 됩니다. 입력하면 관리자에게 승인 요청이 전달됩니다.
        </p>
        <Flash err={str(searchParams.err)} />
        {me.status === "rejected" ? (
          <Flash err={`가입이 거절되었습니다.${me.reject_reason ? ` 사유: ${me.reject_reason}` : ""} Riot ID를 고쳐 다시 신청할 수 있습니다.`} />
        ) : null}
        {me.riot_puuid ? <p className="small muted">현재 등록된 Riot ID: {current}</p> : null}
        <form action={submitRiotId} className="stack">
          <label className="field">
            Riot ID
            <input type="text" name="riot_id" placeholder="이름#KR1" required maxLength={60} autoComplete="off" defaultValue={me.riot_puuid ? current : ""} />
          </label>
          <div className="row">
            <button type="submit" className="btn primary">신청하기</button>
          </div>
        </form>
        <p className="small muted">
          방송 시참 경기만 기록되며, 개인적으로 플레이한 경기는 사이트 통계에 들어가지 않습니다.
        </p>
      </div>
    </main>
  );
}
