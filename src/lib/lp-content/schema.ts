import { z } from "zod";

/** LP の文言・問い合わせ先。管理画面での入力検証とサーバーでの保存時検証で共用 */

/** 文字数・個数の上限（編集画面の文字数カウンターでも使う） */
export const LP_LIMITS = {
  serviceName: 50,
  companyName: 100,
  lineLabel: 30,
  phoneLabel: 30,
  phoneHours: 100,
  heroTitleLine: 30,
  heroTitleLines: 4,
  heroLead: 300,
  formLink: 40,
  heroNote: 40,
  heroNotes: 5,
  sectionTitle: 60,
  forYouItem: 80,
  forYouItems: 10,
  stepTitle: 30,
  stepBody: 200,
  steps: 8,
  entryBody: 400,
  entryPoint: 120,
  entryPoints: 6,
  faqQuestion: 120,
  faqAnswer: 600,
  faqs: 20,
} as const;

const L = LP_LIMITS;

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください`)
    .max(max, `${label}は${max}文字以内で入力してください`);

const lines = (label: string, { min, max, maxLength }: { min: number; max: number; maxLength: number }) =>
  z
    .array(z.string().trim().min(1).max(maxLength, `${label}は1行${maxLength}文字以内で入力してください`))
    .min(min, `${label}を${min}行以上入力してください`)
    .max(max, `${label}は${max}行以内で入力してください`);

export const lpContentSchema = z.object({
  basic: z.object({
    serviceName: text("サービス名", L.serviceName),
    companyName: text("運営会社名", L.companyName),
  }),
  contact: z.object({
    lineUrl: z
      .string()
      .trim()
      .regex(
        /^https:\/\/(line\.me|lin\.ee)\/\S+$/,
        "LINE の URL（https://line.me/ または https://lin.ee/ で始まるもの）を入力してください",
      ),
    lineLabel: text("LINE ボタンの文言", L.lineLabel),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^0[0-9-]{9,12}$/, "電話番号は 0 から始まる数字とハイフンで入力してください"),
    phoneLabel: text("電話ボタンの文言", L.phoneLabel),
    phoneHours: text("受付時間", L.phoneHours),
  }),
  hero: z.object({
    title: lines("見出し", { min: 1, max: L.heroTitleLines, maxLength: L.heroTitleLine }),
    lead: text("リード文", L.heroLead),
    formLink: text("フォームへのリンクの文言", L.formLink),
    formLinkEdit: text("フォームへのリンクの文言（入力済みの人向け）", L.formLink),
    notes: lines("補足", { min: 0, max: L.heroNotes, maxLength: L.heroNote }),
  }),
  forYou: z.object({
    title: text("見出し", L.sectionTitle),
    items: lines("項目", { min: 1, max: L.forYouItems, maxLength: L.forYouItem }),
  }),
  steps: z.object({
    title: text("見出し", L.sectionTitle),
    items: z
      .array(z.object({ title: text("手順の見出し", L.stepTitle), body: text("手順の説明", L.stepBody) }))
      .min(1, "手順を1つ以上入力してください")
      .max(L.steps, `手順は${L.steps}つまでです`),
  }),
  entry: z.object({
    title: text("見出し", L.sectionTitle),
    body: text("説明", L.entryBody),
    points: lines("補足", { min: 0, max: L.entryPoints, maxLength: L.entryPoint }),
  }),
  faq: z.object({
    title: text("見出し", L.sectionTitle),
    items: z
      .array(z.object({ q: text("質問", L.faqQuestion), a: text("回答", L.faqAnswer) }))
      .max(L.faqs, `よくある質問は${L.faqs}個までです`),
  }),
});

export type LpContent = z.infer<typeof lpContentSchema>;
export type LpContentInput = z.input<typeof lpContentSchema>;
