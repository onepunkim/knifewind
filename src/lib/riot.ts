import { need } from "./env";
import { normalizeMatch } from "./riot-parse";
import type { CandData } from "./types";

// Riot Games API (한국 서버는 asia 지역 주소를 씁니다)
const HOST = "https://asia.api.riotgames.com";

export class RiotError extends Error {
  kind: "rate" | "key" | "other";
  constructor(message: string, kind: "rate" | "key" | "other") {
    super(message);
    this.kind = kind;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Riot API 호출. 요청 제한(429)이면 안내된 시간만큼 기다렸다가 다시 시도합니다. 404 는 null */
async function riotGet(path: string, deadline?: number): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(HOST + path, {
      headers: { "X-Riot-Token": need("RIOT_API_KEY") },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (res.status === 429) {
      const wait = Math.min(Number(res.headers.get("retry-after") ?? "2"), 30) * 1000 || 2000;
      if (deadline && Date.now() + wait > deadline) {
        throw new RiotError("Riot API 요청 제한에 걸렸습니다. 잠시 후 다시 눌러 주세요.", "rate");
      }
      await sleep(wait + 200);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new RiotError(
        "Riot API 키가 없거나 만료되었습니다. 개발용 키는 24시간마다 다시 발급받아야 합니다.",
        "key",
      );
    }
    if (!res.ok) {
      if (res.status >= 500 && attempt < 2) {
        await sleep(1000);
        continue;
      }
      throw new RiotError(`Riot API 오류가 발생했습니다 (${res.status}).`, "other");
    }
    return await res.json();
  }
  throw new RiotError("Riot API 요청 제한 때문에 잠시 후 다시 시도해야 합니다.", "rate");
}

export type RiotAccount = { puuid: string; gameName: string; tagLine: string };

export async function lookupRiotId(name: string, tag: string): Promise<RiotAccount | null> {
  const json = await riotGet(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
  );
  if (!json?.puuid) return null;
  return { puuid: json.puuid, gameName: json.gameName ?? name, tagLine: json.tagLine ?? tag };
}

/** 시간대 안에 시작한 경기 ID 목록 (모드 구분 없이 전부). 최대 300개 */
export async function matchIdsInWindow(
  puuid: string,
  startSec: number,
  endSec: number,
  deadline?: number,
): Promise<string[]> {
  const out: string[] = [];
  for (let start = 0; start < 300; start += 100) {
    const q = new URLSearchParams({
      startTime: String(startSec),
      endTime: String(endSec),
      start: String(start),
      count: "100",
    });
    const json = await riotGet(`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${q}`, deadline);
    const list: string[] = Array.isArray(json) ? json : [];
    out.push(...list);
    if (list.length < 100) break;
  }
  return out;
}

export async function fetchMatchData(matchId: string, deadline?: number): Promise<CandData | null> {
  const json = await riotGet(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`, deadline);
  return json ? normalizeMatch(json) : null;
}
