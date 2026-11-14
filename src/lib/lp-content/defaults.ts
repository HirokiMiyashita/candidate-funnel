import { lpContentSchema, type LpContent } from "./schema";

/**
 * LP の初期値。DB に保存されていない場合、または保存内容が壊れている場合に使う。
 * 管理画面の「LP の内容」で編集・保存すると DB の内容が優先される。
 */
export const DEFAULT_LP_CONTENT: LpContent = {
  basic: {
    serviceName: "キャリア相談（仮）",
    companyName: "株式会社〇〇（仮）",
  },
  contact: {
    lineUrl: "https://line.me/R/ti/p/@243hzoup",
    lineLabel: "LINEで相談する",
    phoneNumber: "0120-000-000",
    phoneLabel: "電話で相談する",
    phoneHours: "受付 10:00〜19:00（土日祝を除く）（仮）",
  },
  hero: {
    title: ["次の職場の話を、", "30分だけ", "聞かせてください。"],
    lead: "LINEでも電話でも、話しやすい方法でどうぞ。あなたの希望に合う求人を、担当者が無料でご紹介します。",
    formLink: "フォームで面談の日時を選ぶ",
    formLinkEdit: "フォームの入力内容を変更する",
    notes: ["相談・紹介はすべて無料", "LINEなら24時間メッセージOK", "面談は電話で完結"],
  },
  forYou: {
    title: "こんな方のご相談をお待ちしています",
    items: [
      "今の仕事を続けるか迷っている",
      "自分に合う仕事がわからない",
      "給料や休みの条件を見直したい",
      "忙しくて求人を探す時間がない",
    ],
  },
  steps: {
    title: "ご相談の流れ",
    items: [
      { title: "LINE・電話で連絡", body: "LINEで友だち追加するか、お電話ください。フォームから日時を選ぶこともできます。" },
      { title: "担当者からご連絡", body: "ご希望を確認し、面談の日時を決めます。（仮）" },
      { title: "電話で面談", body: "選んだ日時に30分ほど、希望や不安をお聞きします。" },
      { title: "求人のご紹介", body: "条件に合う求人をご紹介します。応募するかはご自身で決められます。" },
    ],
  },
  entry: {
    title: "フォームで面談の日時を選ぶ",
    body: "LINEや電話が難しい方はこちらから。すべての項目が必須です。保存した内容は、同じブラウザでこのページを開けばいつでも変更できます。",
    points: [
      "保存後、担当者から2営業日以内にお電話します。（仮）",
      "ご都合が変わったら、日時を選び直して保存してください。",
      "入力いただいた情報は、ご相談とご紹介のためだけに使います。",
    ],
  },
  faq: {
    title: "よくある質問",
    items: [
      { q: "費用はかかりますか？", a: "相談から求人のご紹介まで、すべて無料です。" },
      { q: "今の仕事を続けながらでも相談できますか？", a: "はい。在職中の方からのご相談も多くいただいています。面談の日時はご都合に合わせて選べます。" },
      { q: "相談したら必ず転職しないといけませんか？", a: "いいえ。話を聞いてから決めていただいて大丈夫です。" },
      { q: "面談はどこで行いますか？", a: "お電話で行います。来社いただく必要はありません。（仮）" },
      { q: "選んだ日時の都合が悪くなりました。", a: "保存したときと同じブラウザでこのページを開くと、入力内容を変更できます。" },
    ],
  },
};

/**
 * DB の内容を検証して返す。項目単位で壊れていたらその項目だけ初期値に戻す
 * （将来項目を追加したときに、古い保存データでも表示できるように）。
 */
export function parseLpContent(raw: unknown): LpContent {
  if (!raw || typeof raw !== "object") return DEFAULT_LP_CONTENT;

  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_LP_CONTENT) as (keyof LpContent)[]) {
    const section = lpContentSchema.shape[key].safeParse((raw as Record<string, unknown>)[key]);
    merged[key] = section.success ? section.data : DEFAULT_LP_CONTENT[key];
  }
  return merged as LpContent;
}
