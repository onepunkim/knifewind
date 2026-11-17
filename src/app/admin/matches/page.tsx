import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { fmtDateTime, MODE_LABEL } from "@/lib/format";
import { getMatches } from "@/lib/queries";
import { setMatchStatus } from "@/app/actions/admin";
import { Empty, Flash, Pager, SectionHead, str } from "@/components/ui";

export const metadata = { title: "경기 기록 관리" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminMatches({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  const page = Math.max(1, parseInt(str(searchParams.page) ?? "1", 10) || 1);
  const { rows, total } = await getMatches({ page, pageSize: PAGE_SIZE, includeCancelled: true });
  const back = `/admin/matches${page > 1 ? `?page=${page}` : ""}`;

  return (
    <>
      <SectionHead title="경기 기록 관리">
        <Link href="/admin/matches/new" className="btn primary small">경기 직접 등록</Link>
      </SectionHead>
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />
      <section className="card">
        {rows.length === 0 ? (
          <Empty title="등록된 경기가 없습니다" />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 640 }}>
              <thead><tr><th>시간</th><th>모드</th><th>출처</th><th>승리팀</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="num small">{fmtDateTime(m.played_at)}</td>
                    <td>{MODE_LABEL[m.mode] ?? m.mode}</td>
                    <td className="small">{m.source === "manual" ? "직접 등록" : "Riot 조회"}</td>
                    <td className="small">{m.winning_team === 100 ? "블루팀" : m.winning_team === 200 ? "레드팀" : "-"}</td>
                    <td>{m.status === "approved" ? <span className="badge win">승인</span> : <span className="badge loss">승인 취소</span>}</td>
                    <td>
                      <div className="row">
                        <Link href={`/admin/matches/${m.id}`} className="small">수정</Link>
                        <form action={setMatchStatus} className="inline-form">
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="back" value={back} />
                          <input type="hidden" name="status" value={m.status === "approved" ? "cancelled" : "approved"} />
                          <button type="submit" className="btn small">{m.status === "approved" ? "승인 취소" : "다시 승인"}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager basePath="/admin/matches" params={{}} page={page} total={total} pageSize={PAGE_SIZE} />
      </section>
    </>
  );
}
