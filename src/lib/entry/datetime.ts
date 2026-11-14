/** 日本時間（JST）固定の日付・時刻ユーティリティ。サーバー・ブラウザ両方で使う */

export const JST_OFFSET = "+09:00";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const displayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "YYYY-MM-DD"（JST） */
export function jstDateString(date: Date): string {
  return dateFormatter.format(date);
}

/** "HH:mm"（JST） */
export function jstTimeString(date: Date): string {
  return timeFormatter.format(date);
}

/** "YYYY-MM-DD" に日数を加算 */
export function addDays(dateString: string, days: number): string {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 実在する "YYYY-MM-DD" か */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 日付と時刻（JST）から ISO 文字列を作る: "2026-11-20T10:30:00+09:00" */
export function toJstIso(date: string, time: string): string {
  return `${date}T${time}:00${JST_OFFSET}`;
}

/** ISO 文字列を JST の日付・時刻に分解 */
export function splitJst(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return { date: jstDateString(d), time: jstTimeString(d) };
}

/** 表示用: "2026/11/20(金) 10:30" */
export function formatJstDateTime(iso: string): string {
  return displayFormatter.format(new Date(iso));
}

/** 生年月日（"YYYY-MM-DD"）から今日時点（JST）の年齢 */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const today = jstDateString(now);
  const age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? age - 1 : age;
}

/** 表示用: "1990/04/01" */
export function formatDate(dateString: string): string {
  return dateString.replaceAll("-", "/");
}
