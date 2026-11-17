import type { CandData, CandParticipant, Mode, Team } from "./types";

/** "이름#태그" 형태의 Riot ID 를 나눕니다. 형식이 맞지 않으면 null */
export function parseRiotId(input: string): { name: string; tag: string } | null {
  const s = input.trim();
  const i = s.lastIndexOf("#");
  if (i <= 0) return null;
  const name = s.slice(0, i).trim();
  const tag = s.slice(i + 1).trim();
  if (name.length < 1 || name.length > 32) return null;
  if (!/^[A-Za-z0-9가-힣]{2,8}$/.test(tag)) return null;
  return { name, tag };
}

/**
 * 큐 ID로 게임 모드를 추측합니다. 관리자가 승인할 때 바꿀 수 있습니다.
 * 450 = 칼바람 나락(일반). 2400 은 증바람으로 알려진 값이지만 Riot 공식 문서에서 확인하지 못했으므로,
 * 실제 증바람 경기 후보가 '기타'로 나오면 이 값을 고치면 됩니다.
 */
export function guessMode(queueId: number, gameMode: string, gameType: string): Mode {
  if (gameType === "CUSTOM_GAME" || queueId === 0) return "custom";
  if (queueId === 450) return "aram";
  if (queueId === 2400) return "mayhem";
  return "other";
}

/** Riot Match-V5 응답을 사이트에서 쓰는 모양으로 줄입니다. 형식이 이상하면 null */
export function normalizeMatch(raw: any): CandData | null {
  const info = raw?.info;
  const matchId = raw?.metadata?.matchId ?? raw?.metadata?.match_id;
  if (!info || typeof matchId !== "string" || !Array.isArray(info.participants)) return null;

  const participants: CandParticipant[] = [];
  for (const p of info.participants) {
    const teamId = Number(p?.teamId);
    if (teamId !== 100 && teamId !== 200) continue;
    const game = typeof p.riotIdGameName === "string" ? p.riotIdGameName : "";
    const tag = typeof p.riotIdTagline === "string" ? p.riotIdTagline : "";
    participants.push({
      puuid: String(p.puuid ?? ""),
      name: game && tag ? `${game}#${tag}` : String(p.summonerName || game || "알 수 없음"),
      champion: String(p.championName ?? ""),
      teamId: teamId as Team,
      win: Boolean(p.win),
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
    });
  }
  if (participants.length === 0) return null;

  const winner = participants.find((p) => p.win);
  const startMs = Number(info.gameStartTimestamp ?? info.gameCreation) || 0;
  // gameEndTimestamp 가 있으면 gameDuration 은 초 단위, 없으면 밀리초 단위입니다.
  const rawDuration = Number(info.gameDuration) || 0;
  const durationSec = info.gameEndTimestamp ? rawDuration : Math.round(rawDuration / 1000);

  return {
    matchId,
    queueId: Number(info.queueId) || 0,
    gameMode: String(info.gameMode ?? ""),
    gameType: String(info.gameType ?? ""),
    startedAt: new Date(startMs).toISOString(),
    durationSec,
    winningTeam: winner ? winner.teamId : null,
    participants,
  };
}

/** 이 경기에 참가한 승인 회원 수 */
export function countMemberMatches(data: CandData, puuids: Set<string>): number {
  let n = 0;
  for (const p of data.participants) if (p.puuid && puuids.has(p.puuid)) n++;
  return n;
}
