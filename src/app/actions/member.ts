"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { opt } from "@/lib/env";
import { parseRiotId } from "@/lib/riot-parse";
import { lookupRiotId, RiotError } from "@/lib/riot";

function go(path: string, kind: "ok" | "err", msg: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}

/** Riot ID 를 입력해 가입을 신청합니다. 라이엇에서 실제로 존재하는 계정인지 확인하고 PUUID 를 저장합니다. */
export async function submitRiotId(formData: FormData): Promise<void> {
  const me = await requireMember();
  const raw = String(formData.get("riot_id") ?? "");
  const parsed = parseRiotId(raw);
  if (!parsed) go("/join", "err", "Riot ID는 '이름#태그' 형태로 입력해 주세요. 예: 칼바람장인#KR1");

  // 승인된 일반 회원이 마음대로 Riot ID를 바꾸지 못하게 막습니다. (관리자는 가능)
  if (me.status === "approved" && me.role !== "admin") {
    go("/me", "err", "승인된 회원의 Riot ID 변경은 관리자에게 요청해 주세요.");
  }
  if (!opt("RIOT_API_KEY")) {
    go("/join", "err", "서버에 Riot API 키가 설정되지 않아 Riot ID를 확인할 수 없습니다. 관리자에게 알려 주세요.");
  }

  let account;
  try {
    account = await lookupRiotId(parsed!.name, parsed!.tag);
  } catch (e) {
    const msg = e instanceof RiotError ? e.message : "Riot ID를 확인하는 중 문제가 생겼습니다.";
    go("/join", "err", msg);
  }
  if (!account) go("/join", "err", "해당 Riot ID를 찾을 수 없습니다. 이름과 태그를 다시 확인해 주세요.");

  const { data: dup } = await db()
    .from("members")
    .select("id")
    .eq("riot_puuid", account!.puuid)
    .neq("id", me.id)
    .maybeSingle();
  if (dup) go("/join", "err", "이미 다른 회원이 사용 중인 Riot ID입니다. 본인 계정이 맞다면 관리자에게 문의해 주세요.");

  const patch: Record<string, unknown> = {
    riot_game_name: account!.gameName,
    riot_tag_line: account!.tagLine,
    riot_puuid: account!.puuid,
    reject_reason: null,
  };
  if (me.status !== "approved") patch.status = "pending";

  const { error } = await db().from("members").update(patch).eq("id", me.id);
  if (error) go("/join", "err", "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");

  go("/me", "ok", me.status === "approved" ? "Riot ID를 저장했습니다." : "가입 신청이 접수되었습니다. 관리자 승인을 기다려 주세요.");
}
