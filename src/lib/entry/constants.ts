import { addDays, jstDateString } from "./datetime";

/** 再編集用トークンを保存する Cookie */
export const ENTRY_COOKIE_NAME = "cf_entry";
/** Cookie の有効期間（90 日） */
export const ENTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** 面接候補日時の選択肢の設定（JST） */
export const INTERVIEW = {
  /** 最初の開始時刻 */
  firstSlot: "10:00",
  /** 最後の開始時刻 */
  lastSlot: "18:30",
  /** 刻み（分） */
  stepMinutes: 30,
  /** 何日後から選べるか（1 = 翌日から） */
  minDaysAhead: 1,
  /** 何日後まで選べるか */
  maxDaysAhead: 60,
} as const;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 選択できる開始時刻の一覧: ["10:00", "10:30", ...] */
export function interviewTimeSlots(): string[] {
  const slots: string[] = [];
  for (
    let t = toMinutes(INTERVIEW.firstSlot);
    t <= toMinutes(INTERVIEW.lastSlot);
    t += INTERVIEW.stepMinutes
  ) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return slots;
}

/** 選択できる日付の範囲（JST の "YYYY-MM-DD"） */
export function interviewDateRange(now: Date = new Date()) {
  const today = jstDateString(now);
  return {
    min: addDays(today, INTERVIEW.minDaysAhead),
    max: addDays(today, INTERVIEW.maxDaysAhead),
  };
}
