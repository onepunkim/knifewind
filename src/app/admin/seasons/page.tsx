import { requireAdmin } from "@/lib/auth";
import { getSeasons } from "@/lib/queries";
import { createSeason, setCurrentSeason, updateSeason } from "@/app/actions/admin";
import { Flash, SectionHead, str } from "@/components/ui";
import { todayKst } from "@/lib/format";

export const metadata = { title: "시즌 관리" };
export const dynamic = "force-dynamic";

export default async function AdminSeasons({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  await requireAdmin();
  const seasons = await getSeasons();

  return (
    <>
      <SectionHead title="시즌 관리" />
      <Flash ok={str(searchParams.ok)} err={str(searchParams.err)} />

      <section className="card gilded stack">
        <h3>새 시즌 만들기</h3>
        <form action={createSeason} className="form-grid" style={{ alignItems: "end" }}>
          <label className="field">이름<input type="text" name="name" placeholder="시즌 2" maxLength={40} required /></label>
          <label className="field">시작일<input type="date" name="starts_on" defaultValue={todayKst()} /></label>
          <div><button type="submit" className="btn primary">만들기</button></div>
        </form>
        <p className="muted small">새 경기는 세션에 지정된 시즌에 들어갑니다. 시즌을 바꿀 때는 새 시즌을 만든 뒤 &lsquo;현재 시즌으로 지정&rsquo;하세요.</p>
      </section>

      {seasons.map((s) => (
        <section className="card stack" key={s.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>{s.name} {s.is_current ? <span className="badge gold">현재 시즌</span> : null}</h3>
            {!s.is_current ? (
              <form action={setCurrentSeason}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="btn small">현재 시즌으로 지정</button>
              </form>
            ) : null}
          </div>
          <form action={updateSeason} className="form-grid" style={{ alignItems: "end" }}>
            <input type="hidden" name="id" value={s.id} />
            <label className="field">이름<input type="text" name="name" defaultValue={s.name} maxLength={40} required /></label>
            <label className="field">시작일<input type="date" name="starts_on" defaultValue={s.starts_on} /></label>
            <label className="field">종료일<input type="date" name="ends_on" defaultValue={s.ends_on ?? ""} /></label>
            <div><button type="submit" className="btn small">저장</button></div>
          </form>
        </section>
      ))}
    </>
  );
}
