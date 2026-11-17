"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container" style={{ paddingBlock: 64 }}>
      <div className="card gilded stack">
        <h1 style={{ fontSize: "1.5rem" }}>문제가 생겼습니다</h1>
        <p className="muted">
          화면을 불러오는 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.
          (처음 설치하는 중이라면 환경 변수와 데이터베이스 설정이 끝났는지 확인해 주세요.)
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => reset()}>다시 시도</button>
          <a className="btn" href="/">홈으로</a>
        </div>
      </div>
    </main>
  );
}
