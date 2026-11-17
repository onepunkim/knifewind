import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, riotIdText } from "@/lib/format";
import type { Member } from "@/lib/types";
import {
  approveMember,
  banMember,
  refreshPuuids,
  rejectMember,
  setMemberRole,
  unbanMember,
} from "@/app/actions/admin";
import { Empty, Flash, SectionHead, str } from "@/components/ui";

export const metadata = { title: "회원 관리" };
export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["pending", "승인 대기"],
  ["approved", "승인됨"],
  ["rejected", "거절됨"],
  ["banned", "정지"],
  ["incomplete", "가입 전"],
  ["all", "전체"],
];
const STATUS_TEXT: Record<string, string> = {
  incomplete: "가입 전",
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "거절됨",
  banned: "정지",
};

export default async function AdminMembers({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const me = await requireAdmin();
  const status = str(searchParams.status) || "pending";
  const q = (str(searchParams.q) || "").trim().slice(0, 40);

  let query = db().from("members").select("*");
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("chzzk_name", `%${q}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const list = (data ?? []) as Member[];
  const back = `/admin/members?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <SectionHead title="회원 관리" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      <div className="subnav">
        {TABS.map(([key, label]) => (
          <a key={key} href={`/admin/members?status=${key}`} className={key === status ? "on" : ""}>{label}</a>
        ))}
      </div>

      <form method="get" className="row">
        <input type="hidden" name="status" value={status} />
        <input type="text" name="q" defaultValue={q} placeholder="치지직 닉네임 검색" style={{ maxWidth: 260 }} />
        <button type="submit" className="btn small">검색</button>
      </form>

      <section className="card">
        {list.length === 0 ? (
          <Empty title="해당하는 회원이 없습니다" />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 720 }}>
              <thead>
                <tr><th>치지직 닉네임</th><th>Riot ID</th><th>상태</th><th>가입일</th><th>처리</th></tr>
              </thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.chzzk_name} {m.role === "admin" ? <span className="badge gold">관리자</span> : null}
                    </td>
                    <td className="small">{riotIdText(m.riot_game_name, m.riot_tag_line)}</td>
                    <td>
                      <span className="badge">{STATUS_TEXT[m.status] ?? m.status}</span>
                      {m.reject_reason ? <div className="muted small">{m.reject_reason}</div> : null}
                    </td>
                    <td className="num small">{fmtDate(m.created_at)}</td>
                    <td>
                      <div className="row">
                        {(m.status === "pending" || m.status === "rejected") && m.riot_puuid ? (
                          <form action={approveMember} className="inline-form">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="back" value={back} />
                            <button type="submit" className="btn small primary">승인</button>
                          </form>
                        ) : null}
                        {m.status === "pending" ? (
                          <form action={rejectMember} className="inline-form">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="back" value={back} />
                            <input type="text" name="reason" placeholder="거절 사유(선택)" maxLength={200} />
                            <button type="submit" className="btn small danger">거절</button>
                          </form>
                        ) : null}
                        {m.status === "banned" ? (
                          <form action={unbanMember} className="inline-form">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="back" value={back} />
                            <button type="submit" className="btn small">정지 해제</button>
                          </form>
                        ) : m.id !== me.id ? (
                          <form action={banMember} className="inline-form">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="back" value={back} />
                            <button type="submit" className="btn small danger">정지</button>
                          </form>
                        ) : null}
                        {m.status === "approved" && m.id !== me.id ? (
                          <form action={setMemberRole} className="inline-form">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="back" value={back} />
                            <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                            <button type="submit" className="btn small">{m.role === "admin" ? "관리자 해제" : "관리자 지정"}</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h3>PUUID 다시 조회</h3>
        <p className="muted small">
          Riot API 키(앱)를 바꾸면 회원들의 PUUID 값이 달라질 수 있습니다. 키를 바꾼 뒤에는 한 번 눌러 주세요. 회원이 많으면 시간이 걸려
          여러 번 눌러야 할 수 있습니다.
        </p>
        <form action={refreshPuuids}>
          <input type="hidden" name="back" value={back} />
          <button type="submit" className="btn small">모든 회원 PUUID 다시 조회</button>
        </form>
      </section>
    </>
  );
}
