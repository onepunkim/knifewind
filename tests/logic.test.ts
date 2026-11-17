// 패키지 설치 없이 돌릴 수 있는 계산 로직 시험입니다. 실행: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { aggregateByMember, buildBoards, kda, sortByWins, sumRows } from "../src/lib/stats.ts";
import { countMemberMatches, guessMode, normalizeMatch, parseRiotId } from "../src/lib/riot-parse.ts";

const row = (member_id: string, mode: string, games: number, wins: number, kills: number, deaths: number, assists: number) =>
  ({ member_id, season_id: "s1", mode, games, wins, kills, deaths, assists }) as any;

test("KDA는 데스 0일 때 1로 계산한다", () => {
  assert.equal(kda(10, 0, 5), 15);
  assert.equal(kda(10, 5, 5), 3);
});

test("모드별 행을 회원 단위로 합산한다", () => {
  const rows = [row("a", "aram", 4, 3, 40, 20, 60), row("a", "custom", 1, 0, 5, 5, 5), row("b", "aram", 2, 2, 10, 2, 10)];
  const m = aggregateByMember(rows);
  const a = m.get("a")!;
  assert.equal(a.games, 5);
  assert.equal(a.wins, 3);
  assert.equal(a.losses, 2);
  assert.equal(a.kills, 45);
  assert.equal(a.winRate, 0.6);
  assert.equal(sumRows([]).winRate, 0);
});

test("명예의 전당: 승률/KDA는 최소 참여 판수를 넘긴 회원만", () => {
  const rows = [row("a", "aram", 10, 6, 100, 50, 100), row("b", "aram", 2, 2, 30, 1, 30), row("c", "aram", 6, 5, 60, 30, 60)];
  const boards = buildBoards(aggregateByMember(rows), 5);
  const get = (k: string) => boards.find((b) => b.key === k)!;
  assert.deepEqual(get("games").entries.map((e) => e.memberId), ["a", "c", "b"]);
  assert.deepEqual(get("winrate").entries.map((e) => e.memberId), ["c", "a"]); // b는 2판이라 제외
  assert.deepEqual(get("kda").entries.map((e) => e.memberId), ["a", "c"]); // KDA가 같으면 참여 경기가 많은 a가 먼저
  assert.equal(get("winrate").entries[0].label, "83.3%");
});

test("순위 미리보기는 승리 수, 승률 순", () => {
  const m = aggregateByMember([row("a", "aram", 10, 5, 0, 0, 0), row("b", "aram", 6, 5, 0, 0, 0), row("c", "aram", 3, 1, 0, 0, 0)]);
  const sorted = sortByWins(Array.from(m.entries()).map(([memberId, agg]) => ({ memberId, agg })));
  assert.deepEqual(sorted.map((e) => e.memberId), ["b", "a", "c"]);
});

test("Riot ID 형식 검사", () => {
  assert.deepEqual(parseRiotId(" 칼바람#KR1 "), { name: "칼바람", tag: "KR1" });
  assert.deepEqual(parseRiotId("Hide on bush#KR1"), { name: "Hide on bush", tag: "KR1" });
  assert.equal(parseRiotId("태그없음"), null);
  assert.equal(parseRiotId("#KR1"), null);
  assert.equal(parseRiotId("이름#"), null);
});

test("게임 모드 추측", () => {
  assert.equal(guessMode(450, "ARAM", "MATCHED_GAME"), "aram");
  assert.equal(guessMode(0, "ARAM", "CUSTOM_GAME"), "custom");
  assert.equal(guessMode(2400, "KIWI", "MATCHED_GAME"), "mayhem");
  assert.equal(guessMode(420, "CLASSIC", "MATCHED_GAME"), "other");
});

function fakeMatch(withEnd: boolean) {
  const players = Array.from({ length: 10 }, (_, i) => ({
    puuid: `p${i}`,
    riotIdGameName: `유저${i}`,
    riotIdTagline: "KR1",
    championName: i % 2 ? "Ashe" : "Lux",
    teamId: i < 5 ? 100 : 200,
    win: i < 5,
    kills: i,
    deaths: 2,
    assists: 3,
  }));
  return {
    metadata: { matchId: "KR_123" },
    info: {
      queueId: 450,
      gameMode: "ARAM",
      gameType: "MATCHED_GAME",
      gameStartTimestamp: Date.UTC(2026, 10, 17, 11, 0, 0),
      gameDuration: withEnd ? 1260 : 1260000,
      gameEndTimestamp: withEnd ? Date.UTC(2026, 10, 17, 11, 21, 0) : undefined,
      participants: players,
    },
  };
}

test("Riot 경기 응답을 줄여서 읽는다 (초/밀리초 모두)", () => {
  for (const withEnd of [true, false]) {
    const d = normalizeMatch(fakeMatch(withEnd))!;
    assert.equal(d.matchId, "KR_123");
    assert.equal(d.durationSec, 1260);
    assert.equal(d.winningTeam, 100);
    assert.equal(d.participants.length, 10);
    assert.equal(d.participants[0].name, "유저0#KR1");
    assert.equal(d.startedAt, "2026-11-17T11:00:00.000Z");
  }
  assert.equal(normalizeMatch({}), null);
});

test("후보 경기에서 승인 회원 수를 센다", () => {
  const d = normalizeMatch(fakeMatch(true))!;
  assert.equal(countMemberMatches(d, new Set(["p1", "p7", "zzz"])), 2);
});
