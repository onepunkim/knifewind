import Link from "next/link";
import { champLabel, type ChampNames } from "@/lib/champions";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import type { MatchRow, ParticipantRow } from "@/lib/types";
import { MemberLink, ModeBadge, TeamBadge } from "./ui";

function PlayerName({ p, admin }: { p: ParticipantRow; admin: boolean }) {
  if (p.member_id && p.members && p.members.status === "approved") {
    return <MemberLink id={p.member_id} name={p.members.chzzk_name} />;
  }
  // 가입하지 않은 참가자의 Riot ID는 공개 화면에 보이지 않게 합니다. (관리자 화면에서는 보입니다)
  return <span className="nonmember">{admin ? p.riot_name : "비회원"}</span>;
}

function TeamBlock({
  team,
  parts,
  match,
  names,
  admin,
}: {
  team: 100 | 200;
  parts: ParticipantRow[];
  match: MatchRow;
  names: ChampNames;
  admin: boolean;
}) {
  const list = parts.filter((p) => p.team_id === team);
  return (
    <div className={`team ${team === 100 ? "blue" : "red"}`}>
      <h3>
        <TeamBadge team={team} win={match.winning_team ? match.winning_team === team : undefined} />
      </h3>
      {list.length === 0 ? <p className="muted small">기록 없음</p> : null}
      {list.map((p) => (
        <div className="player" key={p.id}>
          <span className="who">
            <PlayerName p={p} admin={admin} /> <span className="muted small">{champLabel(names, p.champion)}</span>
          </span>
          <span className="num muted">
            {p.kills}/{p.deaths}/{p.assists}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MatchCard({
  match,
  parts,
  names,
  href,
  admin = false,
}: {
  match: MatchRow;
  parts: ParticipantRow[];
  names: ChampNames;
  href?: string;
  admin?: boolean;
}) {
  return (
    <article className="card match">
      <div className="match-top">
        <ModeBadge mode={match.mode} />
        {match.status === "cancelled" ? <span className="badge loss">승인 취소됨</span> : null}
        {match.source === "manual" ? <span className="badge gold">수동 등록</span> : null}
        <span className="num">{fmtDateTime(match.played_at)}</span>
        <span className="muted small">{fmtDuration(match.duration_seconds)}</span>
        {href ? (
          <Link href={href} className="small" style={{ marginLeft: "auto" }}>
            {admin ? "관리" : "자세히"}
          </Link>
        ) : null}
      </div>
      <div className="match-teams">
        <TeamBlock team={100} parts={parts} match={match} names={names} admin={admin} />
        <TeamBlock team={200} parts={parts} match={match} names={names} admin={admin} />
      </div>
      {match.note ? <p className="muted small">메모: {match.note}</p> : null}
    </article>
  );
}
