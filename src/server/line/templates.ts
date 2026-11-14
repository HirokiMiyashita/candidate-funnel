import { z } from "zod";

/**
 * LINE の自動返信の文面（管理画面で編集）。
 * どの場面で送るか・ボタンはコードで決め、文面だけを編集できるようにしている。
 */

export type TemplateDef = {
  key: string;
  /** 管理画面での表示 */
  label: string;
  /** いつ送るか */
  description: string;
  /** グループ（管理画面の並び） */
  group: "phone" | "registration" | "linked";
  /** 使える差し込み項目 */
  variables?: { name: string; description: string }[];
  /** 空（送らない）を許可するか */
  allowEmpty?: boolean;
  defaults: string[];
};

export const LINE_TEMPLATE_DEFS: TemplateDef[] = [
  // ---- 電話番号の照合 ----
  {
    key: "follow",
    group: "phone",
    label: "友だち追加",
    description: "友だち追加されたとき（未連携の人）。電話番号の入力をお願いする",
    defaults: [
      "友だち追加ありがとうございます！",
      "ご登録の確認のため、電話番号を送信してください。\n例: 09012345678",
    ],
  },
  {
    key: "phone_invalid",
    group: "phone",
    label: "電話番号の形式違い",
    description: "電話番号を待っているときに、電話番号ではない内容が届いたとき",
    defaults: ["電話番号の形式で送信してください。\n例: 09012345678（ハイフンなし）"],
  },
  {
    key: "phone_matched",
    group: "phone",
    label: "照合できた",
    description: "送られた電話番号の応募が見つかり、LINE とつないだとき（氏名などは表示しない）",
    defaults: ["ご登録を確認できました。ありがとうございます！", "担当者から改めてご連絡いたします。"],
  },
  {
    key: "phone_linked_other",
    group: "phone",
    label: "別の LINE で連携済み",
    description: "送られた電話番号が、すでに別の LINE アカウントとつながっていたとき",
    defaults: ["この電話番号はすでに別の LINE アカウントで登録されています。お手数ですが、担当者からのご連絡をお待ちください。"],
  },
  {
    key: "phone_not_found",
    group: "phone",
    label: "未登録（入力方法の選択）",
    description: "送られた電話番号の応募が見つからなかったとき。［LINE で入力］［フォームで入力］のボタンが付く",
    defaults: ["ご登録がまだのようです。", "このまま LINE で入力するか、フォームで入力するかを選んでください。"],
  },
  {
    key: "too_many_attempts",
    group: "phone",
    label: "試行回数の上限",
    description: "電話番号を何度も試して上限に達したとき（他人の番号を探られないための制限）",
    defaults: ["確認できませんでした。お手数ですが、担当者からのご連絡をお待ちください。"],
  },
  // ---- 未登録の人の登録 ----
  {
    key: "registration_form_link",
    group: "registration",
    label: "フォームで入力",
    description: "［フォームで入力］を選んだとき。リンクから登録すると自動で LINE とつながる",
    variables: [{ name: "lp_url", description: "登録フォームのリンク（LINE とつなぐための情報付き）" }],
    defaults: ["こちらのフォームからご登録ください。\n{{lp_url}}"],
  },
  {
    key: "ask_name",
    group: "registration",
    label: "氏名を聞く",
    description: "［LINE で入力］を選んだとき（入力の最初）",
    defaults: ["ありがとうございます。いくつか質問にお答えください。", "まず、お名前（フルネーム）を送信してください。"],
  },
  {
    key: "ask_birth_date",
    group: "registration",
    label: "生年月日を聞く",
    description: "氏名の次。［生年月日を選ぶ］ボタンが付く",
    variables: [{ name: "name", description: "入力された氏名" }],
    defaults: ["{{name}} さん、ありがとうございます。", "生年月日を選んでください。"],
  },
  {
    key: "ask_prefecture_region",
    group: "registration",
    label: "地方を聞く",
    description: "生年月日の次。地方のボタンが付く（都道府県名を直接送ってもよい）",
    defaults: ["お住まいの地域を選んでください。"],
  },
  {
    key: "ask_prefecture",
    group: "registration",
    label: "都道府県を聞く",
    description: "地方を選んだ次。都道府県のボタンが付く",
    defaults: ["都道府県を選んでください。"],
  },
  {
    key: "ask_interview_1",
    group: "registration",
    label: "第1希望を聞く",
    description: "都道府県の次。［日時を選ぶ］ボタンが付く",
    variables: [{ name: "interview_rule", description: "選べる日時の説明（例: 翌日〜60日後の 10:00〜18:30、30分刻み）" }],
    defaults: ["面談（お電話・30分ほど）の第1希望の日時を選んでください。\n{{interview_rule}}"],
  },
  {
    key: "ask_interview_2",
    group: "registration",
    label: "第2希望を聞く",
    description: "第1希望の次",
    variables: [{ name: "interview_rule", description: "選べる日時の説明" }],
    defaults: ["第2希望の日時を選んでください（第1希望と別の日時）。\n{{interview_rule}}"],
  },
  {
    key: "invalid_interview",
    group: "registration",
    label: "選べない日時",
    description: "範囲外・30分刻みでない・第1希望と同じ日時が選ばれたとき",
    variables: [{ name: "interview_rule", description: "選べる日時の説明" }],
    defaults: ["その日時は選べません。\n{{interview_rule}}"],
  },
  {
    key: "ask_consent",
    group: "registration",
    label: "同意を聞く",
    description: "第2希望の次。［同意する］ボタンが付く",
    variables: [{ name: "privacy_url", description: "プライバシーポリシーのリンク" }],
    defaults: ["最後に、プライバシーポリシーをご確認のうえ、同意をお願いします。\n{{privacy_url}}"],
  },
  {
    key: "confirm",
    group: "registration",
    label: "入力内容の確認",
    description: "同意の次。［この内容で登録］［最初からやり直す］ボタンが付く",
    variables: [{ name: "summary", description: "入力内容のまとめ" }],
    defaults: ["以下の内容で登録します。よろしいですか？\n\n{{summary}}"],
  },
  {
    key: "registration_completed",
    group: "registration",
    label: "登録完了",
    description: "［この内容で登録］を押したとき",
    defaults: ["ご登録ありがとうございます！", "担当者から希望日時にお電話いたします。"],
  },
  {
    key: "invalid_input",
    group: "registration",
    label: "入力の受け付けられない内容",
    description: "入力中に、その質問に合わない内容が届いたとき（直前の質問をもう一度送る）",
    defaults: ["すみません、うまく受け取れませんでした。"],
  },
  // ---- 連携済み ----
  {
    key: "linked_message",
    group: "linked",
    label: "連携済みの人からのメッセージ",
    description: "連携済みの人からメッセージが届いたとき。空にすると自動では返信しない",
    allowEmpty: true,
    defaults: ["メッセージありがとうございます。内容を確認のうえ、担当者からご連絡いたします。"],
  },
];

export type TemplateKey = (typeof LINE_TEMPLATE_DEFS)[number]["key"];
export type TemplateMap = Record<string, string[]>;

export const TEMPLATE_MAX_MESSAGES = 3;
export const TEMPLATE_MAX_LENGTH = 1000;

const DEF_BY_KEY = new Map(LINE_TEMPLATE_DEFS.map((d) => [d.key, d]));

/** 保存・シミュレーター用の入力検証 */
export const templateMapSchema = z
  .record(
    z.string(),
    z
      .array(z.string().trim().min(1, "空のメッセージがあります").max(TEMPLATE_MAX_LENGTH))
      .max(TEMPLATE_MAX_MESSAGES, `1 つの場面で送れるのは ${TEMPLATE_MAX_MESSAGES} 通までです`),
  )
  .superRefine((map, ctx) => {
    for (const [key, messages] of Object.entries(map)) {
      const def = DEF_BY_KEY.get(key);
      if (!def) {
        ctx.addIssue({ code: "custom", path: [key], message: "不明な場面です" });
      } else if (messages.length === 0 && !def.allowEmpty) {
        ctx.addIssue({ code: "custom", path: [key], message: "メッセージを 1 つ以上入力してください" });
      }
    }
  });

/** DB の内容と初期値をまとめる（DB に無い・壊れている場面は初期値） */
export function resolveTemplates(rows: { key: string; messages: unknown }[]): TemplateMap {
  const map: TemplateMap = Object.fromEntries(LINE_TEMPLATE_DEFS.map((d) => [d.key, d.defaults]));
  for (const row of rows) {
    const def = DEF_BY_KEY.get(row.key);
    if (!def || !Array.isArray(row.messages)) continue;
    const messages = row.messages.filter((m): m is string => typeof m === "string" && m.trim() !== "");
    if (messages.length > 0 || def.allowEmpty) map[row.key] = messages.slice(0, TEMPLATE_MAX_MESSAGES);
  }
  return map;
}

/** 差し込み項目（{{name}} など）を埋めた文面 */
export function renderTemplate(templates: TemplateMap, key: string, vars: Record<string, string> = {}): string[] {
  const messages = templates[key] ?? DEF_BY_KEY.get(key)?.defaults ?? [];
  return messages.map((m) => m.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? ""));
}
