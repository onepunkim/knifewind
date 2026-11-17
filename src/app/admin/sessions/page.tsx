import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, todayKst } from "@/lib/format";
import { getOpenSession, getSeasons } from "@/lib/queries";
import type { PlaySession } from "@/lib/types";
import { startSession } from "@/app/actions/admin";
import { Empty, Flash, SectionHead, str } from "@/components/ui";

export const metadata = { title: "시참 세션" };
export const dynamic = "force-dynamic";

export default async function AdminSessions({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  const [open, seasons] = await Promise.all([getOpenSession(), getSeasons()]);
  const { data } = await db().from("play_sessions").select("*").order("started_at", { ascending: false }).limit(30);
  const list = (data ?? []) as PlaySession[];
  const current = seasons.find((s) => s.is_current);

  return (
    <>
      <SectionHead title="시참 세션" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      {open ? (
        <section className="card gilded stack">
          <div className="row">
            <span className="live"><i aria-hidden="true" />진행 중</span>
            <b>{open.title}</b>
            <span className="muted small">{fmtDateTime(open.started_at)} 시작</span>
          </div>
          <div className="row">
            <Link href={`/admin/sessions/${open.id}`} className="btn primary">세션 화면으로</Link>
          </div>
        </section>
      ) : (
        <section className="card gilded stack">
          <h3>새 시참 세션 시작</h3>
          <p className="muted small">
            시참을 하는 시간대를 기록합니다. 이 시간대에 승인 회원이 한 경기만 후보로 조회되고, 최종 승인은 관리자가 합니다.
          </p>
          <form action={startSession} className="form-grid" style={{ alignItems: "end" }}>
            <label className="field">
              세션 이름
              <input type="text" name="title" defaultValue={`${todayKst()} 시참`} maxLength={80} required />
            </label>
            <label className="field">
              시즌
              <select name="season_id" defaultValue={current?.id ?? ""}>
                <option value="">시즌 없음</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (현재)" : ""}</option>
                ))}
              </select>
            </label>
            <div><button type="submit" className="btn primary">세션 시작</button></div>
          </form>
        </section>
      )}

      <section className="card stack">
        <h3>지난 세션</h3>
        {list.length === 0 ? (
          <Empty title="아직 세션이 없습니다" />
        ) : (
          <div className="table-wrap">
            <table style={{ minWidth: 520 }}>
              <thead><tr><th>이름</th><th>시작</th><th>종료</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td className="num small">{fmtDateTime(s.started_at)}</td>
                    <td className="num small">{fmtDateTime(s.ended_at)}</td>
                    <td><span className={`badge ${s.status === "open" ? "win" : ""}`}>{s.status === "open" ? "진행 중" : "종료"}</span></td>
                    <td><Link href={`/admin/sessions/${s.id}`}>열기</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
