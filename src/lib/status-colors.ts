/** 応募ステータスの色（DB には色のキーを保存） */
export const STATUS_COLORS = ["gray", "blue", "green", "amber", "red", "purple"] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export const STATUS_COLOR_LABEL: Record<StatusColor, string> = {
  gray: "グレー",
  blue: "青",
  green: "緑",
  amber: "黄",
  red: "赤",
  purple: "紫",
};

/** dot: 色の丸 / badge: ステータス表示（背景・文字・枠） */
export const STATUS_COLOR_CLASS: Record<StatusColor, { dot: string; badge: string }> = {
  gray: { dot: "bg-zinc-400", badge: "border-zinc-200 bg-zinc-100 text-zinc-700" },
  blue: { dot: "bg-blue-500", badge: "border-blue-200 bg-blue-50 text-blue-700" },
  green: { dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  amber: { dot: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-800" },
  red: { dot: "bg-red-500", badge: "border-red-200 bg-red-50 text-red-700" },
  purple: { dot: "bg-violet-500", badge: "border-violet-200 bg-violet-50 text-violet-700" },
};

export function statusColorClass(color: string) {
  return STATUS_COLOR_CLASS[(STATUS_COLORS as readonly string[]).includes(color) ? (color as StatusColor) : "gray"];
}
