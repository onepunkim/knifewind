import Link from "next/link";
import type { ReactNode } from "react";
import { MODE_LABEL, pctText } from "@/lib/format";
import type { Agg } from "@/lib/stats";
import type { Season } from "@/lib/types";

export function Flash({ ok, err, info }: { ok?: string; err?: string; info?: string }) {
  if (!ok && !err && !info) return null;
  return (
    <div className="stack">
      {err ? <div className="flash err" role="alert">{err}</div> : null}
      {ok ? <div className="flash ok" role="status">{ok}</div> : null}
      {info ? <div className="flash info" role="status">{info}</div> : null}
    </div>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  return <span className="badge">{MODE_LABEL[mode] ?? mode}</span>;
}

export function TeamBadge({ team, win }: { team: number; win?: boolean }) {
  return (
    <span className={`badge ${team === 100 ? "blue" : "red"}`}>
      {team === 100 ? "블루팀" : "레드팀"}
      {win === undefined ? "" : win ? " 승리" : " 패배"}
    </span>
  );
}

export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function StatGrid({ agg }: { agg: Agg }) {
  return (
    <div className="stats">
      <div className="stat"><b className="num">{agg.games}</b><span>참여 경기</span></div>
      <div className="stat"><b className="num win">{agg.wins}</b><span>승리</span></div>
      <div className="stat"><b className="num loss">{agg.losses}</b><span>패배</span></div>
      <div className="stat"><b className="num">{agg.games ? pctText(agg.winRate) : "-"}</b><span>승률</span></div>
      <div className="stat"><b className="num">{agg.games ? agg.kda.toFixed(2) : "-"}</b><span>평균 KDA</span></div>
      <div className="stat"><b className="num">{agg.kills}/{agg.deaths}/{agg.assists}</b><span>킬/데스/어시</span></div>
    </div>
  );
}

export function MemberLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/members/${id}`}>{name}</Link>;
}

/** 시즌 선택: 자바스크립트 없이 동작하는 GET 폼 */
export function SeasonFilter({
  seasons,
  value,
  action,
  extra,
}: {
  seasons: Season[];
  value: string; // "all" 또는 시즌 ID
  action: string;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <form method="get" action={action} className="row">
      {Object.entries(extra ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        시즌
        <select name="season" defaultValue={value} style={{ width: "auto" }}>
          <option value="all">전체</option>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.is_current ? " (현재)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn small">보기</button>
    </form>
  );
}

export function Pager({
  basePath,
  params,
  page,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav className="pager" aria-label="페이지 이동">
      {page > 1 ? <Link className="btn small" href={href(page - 1)}>이전</Link> : null}
      <span className="muted small num">{page} / {last}</span>
      {page < last ? <Link className="btn small" href={href(page + 1)}>다음</Link> : null}
    </nav>
  );
}

export function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
