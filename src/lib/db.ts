import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { need } from "./env";

let client: SupabaseClient | null = null;

/** 서버에서만 쓰는 데이터베이스 연결 (service_role 키). 브라우저로는 절대 내려가지 않습니다. */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Supabase는 한 번에 1000행까지만 주므로, 더 많을 때 나눠서 모두 가져옵니다. */
export async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await make(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
