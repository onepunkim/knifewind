export const MODE_LABEL: Record<string, string> = {
  aram: "일반 칼바람",
  mayhem: "증바람",
  custom: "사용자 설정",
  other: "기타",
};

export const MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "aram", label: "일반 칼바람" },
  { value: "mayhem", label: "증바람" },
  { value: "custom", label: "사용자 설정 내전" },
  { value: "other", label: "기타" },
];

const TZ = "Asia/Seoul";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${String(s).padStart(2, "0")}초`;
}

export function pctText(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/** <input type="datetime-local"> 값(한국 시간)을 ISO 문자열로 */
export function kstInputToIso(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO 문자열을 <input type="datetime-local"> 값(한국 시간)으로 */
export function isoToKstInput(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);
}

export function kstDayStartIso(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function kstDayEndIso(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T23:59:59.999+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function todayKst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function riotIdText(name: string | null, tag: string | null): string {
  return name && tag ? `${name}#${tag}` : "-";
}
