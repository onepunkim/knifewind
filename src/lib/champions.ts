// 챔피언 이름 한글 표시용. Riot 공개 정적 데이터(Data Dragon)를 하루에 한 번 받아 씁니다.
// 받아오지 못하면 영문 ID 그대로 보여 주므로 사이트는 정상 동작합니다.

export type ChampNames = Record<string, string>; // 영문 ID -> 한글 이름

let memo: { at: number; names: ChampNames } | null = null;

export async function getChampNames(): Promise<ChampNames> {
  if (memo && Date.now() - memo.at < 6 * 3600 * 1000) return memo.names;
  try {
    const vres = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
      next: { revalidate: 86400 },
    });
    const versions = (await vres.json()) as string[];
    const cres = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/ko_KR/champion.json`,
      { next: { revalidate: 86400 } },
    );
    const json = await cres.json();
    const names: ChampNames = {};
    for (const key of Object.keys(json.data ?? {})) {
      const c = json.data[key];
      if (c?.id && c?.name) names[c.id] = c.name;
    }
    memo = { at: Date.now(), names };
    return names;
  } catch {
    return memo?.names ?? {};
  }
}

export function champLabel(names: ChampNames, id: string): string {
  return names[id] || id || "-";
}

/** 관리자가 직접 입력한 챔피언 이름(한글/영문)을 Riot 영문 ID 로 맞춥니다. 못 찾으면 입력값 그대로 */
export function normalizeChampion(input: string, names: ChampNames): string {
  const s = input.trim();
  if (!s) return "";
  const squash = (x: string) => x.replace(/\s+/g, "").toLowerCase();
  const target = squash(s);
  for (const id of Object.keys(names)) {
    if (squash(id) === target || squash(names[id]) === target) return id;
  }
  return s;
}
