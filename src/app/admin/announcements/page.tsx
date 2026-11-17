import { requireAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { getAnnouncements } from "@/lib/queries";
import { deleteAnnouncement, saveAnnouncement } from "@/app/actions/admin";
import { Empty, Flash, SectionHead, str } from "@/components/ui";

export const metadata = { title: "공지 관리" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncements({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  const list = await getAnnouncements(100, true);

  return (
    <>
      <SectionHead title="공지사항 관리" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      <section className="card gilded stack">
        <h3>새 공지</h3>
        <form action={saveAnnouncement} className="stack">
          <label className="field">제목<input type="text" name="title" maxLength={100} required /></label>
          <label className="field">내용<textarea name="body" maxLength={3000} /></label>
          <div className="row">
            <label className="row small"><input type="checkbox" name="published" defaultChecked /> 공개</label>
            <label className="row small"><input type="checkbox" name="pinned" /> 맨 위에 고정</label>
            <button type="submit" className="btn primary">올리기</button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <h3>올린 공지</h3>
        {list.length === 0 ? <Empty title="공지가 없습니다" /> : null}
        {list.map((n) => (
          <details className="fold" key={n.id}>
            <summary>
              {n.pinned ? "📌 " : ""}{n.title}{" "}
              <span className="muted small">{fmtDateTime(n.created_at)}{n.published ? "" : " · 비공개"}</span>
            </summary>
            <form action={saveAnnouncement} className="stack">
              <input type="hidden" name="id" value={n.id} />
              <label className="field">제목<input type="text" name="title" defaultValue={n.title} maxLength={100} required /></label>
              <label className="field">내용<textarea name="body" defaultValue={n.body} maxLength={3000} /></label>
              <div className="row">
                <label className="row small"><input type="checkbox" name="published" defaultChecked={n.published} /> 공개</label>
                <label className="row small"><input type="checkbox" name="pinned" defaultChecked={n.pinned} /> 맨 위에 고정</label>
                <button type="submit" className="btn small primary">저장</button>
              </div>
            </form>
            <form action={deleteAnnouncement} style={{ marginTop: 8 }}>
              <input type="hidden" name="id" value={n.id} />
              <button type="submit" className="btn small danger">삭제</button>
            </form>
          </details>
        ))}
      </section>
    </>
  );
}
