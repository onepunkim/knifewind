import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ paddingBlock: 64 }}>
      <div className="card gilded stack">
        <h1 style={{ fontSize: "1.5rem" }}>찾는 페이지가 없습니다</h1>
        <p className="muted">주소가 바뀌었거나 삭제된 페이지입니다.</p>
        <div className="row">
          <Link className="btn primary" href="/">홈으로</Link>
        </div>
      </div>
    </main>
  );
}
