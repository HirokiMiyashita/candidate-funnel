import { z } from "zod";
import { interviewDateRange, interviewTimeSlots } from "./constants";
import { isValidDateString, jstDateString } from "./datetime";

/**
 * LP の応募フォームの入力スキーマ。
 * ブラウザ（送信前チェック）とサーバー（oRPC の入力検証）で同じものを使う。
 */

/** 全角数字・ハイフン・空白・+81 を正規化して数字のみにする */
export function normalizePhone(value: string): string {
  const halfWidth = value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/＋/g, "+")
    .trim();
  return halfWidth.replace(/^\+81[\s-]*/, "0").replace(/\D/g, "");
}

const MIN_AGE = 15;

export function isValidBirthDate(value: string) {
  if (!isValidDateString(value)) return false;
  const today = jstDateString(new Date());
  const latest = `${Number(today.slice(0, 4)) - MIN_AGE}${today.slice(4)}`;
  return value >= "1900-01-01" && value <= latest;
}

const timeSlots = new Set(interviewTimeSlots());

export function isSelectableInterviewSlot(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):00\+09:00$/.exec(value);
  if (!match) return false;
  const [, date, time] = match;
  if (!isValidDateString(date) || !timeSlots.has(time)) return false;
  const { min, max } = interviewDateRange();
  return date >= min && date <= max;
}

const interviewSlot = z
  .string()
  .min(1, "面談の希望日時を選択してください")
  .refine(isSelectableInterviewSlot, "選択できる範囲の日時を選択してください");

const optionalText = (max: number) => z.string().trim().max(max).optional();

/** 流入元（広告・SNS のパラメータなど） */
export const attributionSchema = z.object({
  utmSource: optionalText(255),
  utmMedium: optionalText(255),
  utmCampaign: optionalText(255),
  utmTerm: optionalText(255),
  utmContent: optionalText(255),
  gclid: optionalText(255),
  fbclid: optionalText(255),
  referrer: optionalText(2000),
  landingUrl: optionalText(2000),
});

export const entryInputSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "氏名を入力してください")
      .max(100, "氏名は 100 文字以内で入力してください"),
    birthDate: z
      .string()
      .min(1, "生年月日を入力してください")
      .refine(isValidBirthDate, "正しい生年月日を入力してください"),
    phone: z
      .string()
      .min(1, "電話番号を入力してください")
      .transform(normalizePhone)
      .pipe(z.string().regex(/^0\d{9,10}$/, "電話番号の形式が正しくありません")),
    prefectureCode: z
      .number()
      .int()
      .min(1, "都道府県を選択してください")
      .max(47, "都道府県を選択してください"),
    interviewAt1: interviewSlot,
    interviewAt2: interviewSlot,
    privacyConsent: z.literal(true, { error: "プライバシーポリシーへの同意が必要です" }),
    /** ボット対策のダミー項目（人間には見えない。値が入っていたらボットとみなす） */
    website: z.string().max(200).optional(),
    attribution: attributionSchema.optional(),
    /** LP の計測の訪問者 ID（LINE・電話ボタンの押下と応募をつなげるため） */
    visitorId: z.uuid().optional(),
    /** LINE から送った LP のリンクに付く使い捨てトークン（保存時に LINE とつなぐ） */
    lineLinkToken: z.string().max(200).optional(),
  })
  .refine((d) => d.interviewAt1 !== d.interviewAt2, {
    message: "第1希望と異なる日時を選択してください",
    path: ["interviewAt2"],
  });

export type EntryInput = z.input<typeof entryInputSchema>;
export type Attribution = z.infer<typeof attributionSchema>;
