import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSessionMemberId } from "./session";
import type { Member } from "./types";

/**
 * 현재 로그인한 회원. 매 요청마다 데이터베이스에서 다시 읽으므로
 * 관리자가 정지하거나 권한을 바꾸면 즉시 반영됩니다.
 */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const id = await readSessionMemberId();
  if (!id) return null;
  const { data } = await db().from("members").select("*").eq("id", id).maybeSingle();
  if (!data || data.status === "banned") return null;
  return data as Member;
});

export async function requireMember(): Promise<Member> {
  const m = await getCurrentMember();
  if (!m) redirect("/login");
  return m as Member;
}

export async function requireAdmin(): Promise<Member> {
  const m = await requireMember();
  if (m.role !== "admin" || m.status !== "approved") redirect("/");
  return m;
}
