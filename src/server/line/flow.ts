import { INTERVIEW, interviewDateRange } from "@/lib/entry/constants";
import { formatDate, formatJstDateTime, jstDateString, toJstIso } from "@/lib/entry/datetime";
import { isSelectableInterviewSlot, isValidBirthDate, normalizePhone } from "@/lib/entry/schema";
import { findPrefectureCode, PREFECTURE_REGIONS, PREFECTURES, prefectureName } from "@/lib/prefectures";
import { renderTemplate, type TemplateMap } from "./templates";
import type { FlowInput, LineDraft, LineState, OutMessage, QuickReplyItem } from "./types";

/** 電話番号を試せる回数（他人の番号を総当たりで探られないための上限） */
export const MAX_PHONE_ATTEMPTS = 5;

/** 会話の状態（DB の line_users の 1 行に対応） */
export type LineUserState = {
  state: LineState;
  phone: string | null;
  draft: LineDraft;
  phoneAttempts: number;
  candidateId: string | null;
  followed: boolean;
};

/** DB への読み書き（本番とシミュレーターで差し替える） */
export interface LineStore {
  getUser(): Promise<LineUserState | null>;
  saveUser(user: LineUserState): Promise<void>;
  /** 電話番号の人を探す */
  findCandidateByPhone(phone: string): Promise<{ id: string; lineUserId: string | null } | null>;
  /** 人と LINE をつなぐ（つないだら true） */
  linkCandidate(candidateId: string): Promise<boolean>;
  /** LINE で入力された内容で登録する */
  register(input: {
    fullName: string;
    birthDate: string;
    phone: string;
    prefectureCode: number;
    interviewAt1: string;
    interviewAt2: string;
  }): Promise<void>;
  /** LP のフォームで登録したときに LINE とつなぐための使い捨てトークンを作る */
  createLinkToken(): Promise<string>;
}

export type FlowContext = {
  store: LineStore;
  templates: TemplateMap;
  /** LP のリンクなどに使うサイトの URL */
  siteUrl: string;
  /** 自分自身の LINE ユーザー ID（連携済みかの判定に使う） */
  lineUserId: string;
};

const LP_UTM = "utm_source=line&utm_medium=line_chat&utm_campaign=unregistered";

// ---------------------------------------------------------------------------
// メッセージ・ボタンの組み立て
// ---------------------------------------------------------------------------

function messages(ctx: FlowContext, key: string, vars: Record<string, string> = {}, quickReply?: QuickReplyItem[]) {
  const texts = renderTemplate(ctx.templates, key, vars);
  const out: OutMessage[] = texts.map((text) => ({ text }));
  if (quickReply && out.length > 0) out[out.length - 1].quickReply = quickReply;
  return out;
}

function interviewRule() {
  return `翌日〜${INTERVIEW.maxDaysAhead}日後の ${INTERVIEW.firstSlot}〜${INTERVIEW.lastSlot}（${INTERVIEW.stepMinutes}分刻み）`;
}

function latestBirthDate() {
  const today = jstDateString(new Date());
  return `${Number(today.slice(0, 4)) - 15}${today.slice(4)}`;
}

const QR = {
  notFound: (): QuickReplyItem[] => [
    { type: "postback", label: "LINE で入力する", data: "reg=chat", displayText: "LINE で入力する" },
    { type: "postback", label: "フォームで入力する", data: "reg=form", displayText: "フォームで入力する" },
    { type: "postback", label: "電話番号を入れ直す", data: "reg=retry", displayText: "電話番号を入れ直す" },
  ],
  birthDate: (): QuickReplyItem[] => [
    {
      type: "datetimepicker",
      label: "生年月日を選ぶ",
      data: "birth",
      mode: "date",
      initial: "1995-01-01",
      min: "1900-01-01",
      max: latestBirthDate(),
    },
  ],
  regions: (): QuickReplyItem[] =>
    PREFECTURE_REGIONS.map((r) => ({ type: "postback", label: r.name, data: `region=${r.key}`, displayText: r.name })),
  prefectures: (regionKey: string): QuickReplyItem[] => {
    const region = PREFECTURE_REGIONS.find((r) => r.key === regionKey);
    const items: QuickReplyItem[] = (region?.codes ?? []).map((code) => ({
      type: "postback",
      label: PREFECTURES[code - 1],
      data: `pref=${code}`,
      displayText: PREFECTURES[code - 1],
    }));
    items.push({ type: "postback", label: "地方を選び直す", data: "region=back", displayText: "地方を選び直す" });
    return items;
  },
  interview: (data: "interview1" | "interview2"): QuickReplyItem[] => {
    const { min, max } = interviewDateRange();
    return [
      {
        type: "datetimepicker",
        label: "日時を選ぶ",
        data,
        mode: "datetime",
        initial: `${min}T${INTERVIEW.firstSlot}`,
        min: `${min}T${INTERVIEW.firstSlot}`,
        max: `${max}T${INTERVIEW.lastSlot}`,
      },
    ];
  },
  consent: (): QuickReplyItem[] => [
    { type: "postback", label: "同意する", data: "consent=yes", displayText: "同意する" },
  ],
  confirm: (): QuickReplyItem[] => [
    { type: "postback", label: "この内容で登録", data: "confirm=yes", displayText: "この内容で登録" },
    { type: "postback", label: "最初からやり直す", data: "confirm=restart", displayText: "最初からやり直す" },
  ],
};

function summary(user: LineUserState) {
  const d = user.draft;
  return [
    `氏名: ${d.fullName ?? ""}`,
    `生年月日: ${d.birthDate ? formatDate(d.birthDate) : ""}`,
    `電話番号: ${user.phone ?? ""}`,
    `都道府県: ${d.prefectureCode ? prefectureName(d.prefectureCode) : ""}`,
    `第1希望: ${d.interviewAt1 ? formatJstDateTime(d.interviewAt1) : ""}〜`,
    `第2希望: ${d.interviewAt2 ? formatJstDateTime(d.interviewAt2) : ""}〜`,
  ].join("\n");
}

/** 今の状態の質問を（もう一度）送る */
function ask(ctx: FlowContext, user: LineUserState): OutMessage[] {
  switch (user.state) {
    case "awaiting_phone":
      return messages(ctx, "phone_invalid");
    case "choosing_registration":
      return messages(ctx, "phone_not_found", {}, QR.notFound());
    case "reg_name":
      return messages(ctx, "ask_name");
    case "reg_birth_date":
      return messages(ctx, "ask_birth_date", { name: user.draft.fullName ?? "" }, QR.birthDate());
    case "reg_prefecture_region":
      return messages(ctx, "ask_prefecture_region", {}, QR.regions());
    case "reg_prefecture":
      return messages(ctx, "ask_prefecture", {}, QR.prefectures(user.draft.region ?? ""));
    case "reg_interview_1":
      return messages(ctx, "ask_interview_1", { interview_rule: interviewRule() }, QR.interview("interview1"));
    case "reg_interview_2":
      return messages(ctx, "ask_interview_2", { interview_rule: interviewRule() }, QR.interview("interview2"));
    case "reg_consent":
      return messages(ctx, "ask_consent", { privacy_url: `${ctx.siteUrl}/privacy` }, QR.consent());
    case "reg_confirm":
      return messages(ctx, "confirm", { summary: summary(user) }, QR.confirm());
    case "linked":
      return messages(ctx, "linked_message");
    case "locked":
      return messages(ctx, "too_many_attempts");
  }
}

function moveTo(ctx: FlowContext, user: LineUserState, state: LineState, prefix: OutMessage[] = []): OutMessage[] {
  user.state = state;
  return [...prefix, ...ask(ctx, user)];
}

/** 入力中に受け付けられない内容が来たとき: 一言添えて直前の質問をもう一度 */
function retry(ctx: FlowContext, user: LineUserState) {
  return [...messages(ctx, "invalid_input"), ...ask(ctx, user)];
}

function parsePostback(data: string) {
  const [name, value = ""] = data.split("=");
  return { name, value };
}

/** "1990-04-01" / "1990/4/1" / "19900401" を "1990-04-01" に */
function parseDateText(text: string): string | null {
  const t = text.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  let m = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(t);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 日時選択の値 "2026-11-20T10:30" を JST の ISO 文字列に */
function pickerToIso(value: string | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  return m ? toJstIso(m[1], m[2]) : null;
}

const REG_STATES: LineState[] = [
  "choosing_registration",
  "reg_name",
  "reg_birth_date",
  "reg_prefecture_region",
  "reg_prefecture",
  "reg_interview_1",
  "reg_interview_2",
  "reg_consent",
  "reg_confirm",
];

// ---------------------------------------------------------------------------
// メインの処理
// ---------------------------------------------------------------------------

/**
 * LINE から届いた出来事を処理し、返信するメッセージを返す。
 * 状態の更新・照合・登録は ctx.store を通して行う。
 */
export async function handleLineInput(ctx: FlowContext, input: FlowInput): Promise<OutMessage[]> {
  const existing = await ctx.store.getUser();
  const user: LineUserState = existing ?? {
    state: "awaiting_phone",
    phone: null,
    draft: {},
    phoneAttempts: 0,
    candidateId: null,
    followed: true,
  };

  const replies = await decide(ctx, user, input);
  await ctx.store.saveUser(user);
  return replies;
}

async function decide(ctx: FlowContext, user: LineUserState, input: FlowInput): Promise<OutMessage[]> {
  // ---- 友だち追加・ブロック ----
  if (input.kind === "unfollow") {
    user.followed = false;
    return [];
  }
  if (input.kind === "follow") {
    user.followed = true;
    if (user.state === "linked") return messages(ctx, "linked_message");
    if (user.state === "locked") return messages(ctx, "too_many_attempts");
    user.state = "awaiting_phone";
    user.draft = {};
    return messages(ctx, "follow");
  }

  const text = input.kind === "text" ? input.text.trim() : "";
  const postback = input.kind === "postback" ? parsePostback(input.data) : null;

  // ---- 連携済み・上限 ----
  if (user.state === "linked") return messages(ctx, "linked_message");
  if (user.state === "locked") return messages(ctx, "too_many_attempts");

  // ---- 入力中ならいつでも使えることば ----
  if (REG_STATES.includes(user.state) && input.kind === "text") {
    if (/^(やり直す|最初から)$/.test(text)) {
      user.draft = {};
      return moveTo(ctx, user, "reg_name");
    }
    if (/^フォーム(で入力(する)?)?$/.test(text)) return sendFormLink(ctx, user);
  }

  switch (user.state) {
    // ---- 電話番号の照合 ----
    case "awaiting_phone": {
      if (input.kind !== "text") return messages(ctx, "phone_invalid");
      const phone = normalizePhone(text);
      if (!/^0\d{9,10}$/.test(phone)) return messages(ctx, "phone_invalid");

      user.phoneAttempts += 1;
      if (user.phoneAttempts > MAX_PHONE_ATTEMPTS) {
        user.state = "locked";
        return messages(ctx, "too_many_attempts");
      }

      user.phone = phone;
      const candidate = await ctx.store.findCandidateByPhone(phone);
      if (!candidate) {
        user.state = "choosing_registration";
        return messages(ctx, "phone_not_found", {}, QR.notFound());
      }
      if (candidate.lineUserId && candidate.lineUserId !== ctx.lineUserId) {
        return messages(ctx, "phone_linked_other");
      }
      if (candidate.lineUserId === ctx.lineUserId || (await ctx.store.linkCandidate(candidate.id))) {
        user.state = "linked";
        user.candidateId = candidate.id;
        return messages(ctx, "phone_matched");
      }
      return messages(ctx, "phone_linked_other");
    }

    // ---- 未登録: 入力方法を選ぶ ----
    case "choosing_registration": {
      const choice = postback?.name === "reg" ? postback.value : /LINE/i.test(text) ? "chat" : "";
      if (choice === "chat") {
        user.draft = {};
        return moveTo(ctx, user, "reg_name");
      }
      if (choice === "form") return sendFormLink(ctx, user);
      if (choice === "retry") {
        user.state = "awaiting_phone";
        return messages(ctx, "follow").slice(-1);
      }
      return ask(ctx, user);
    }

    // ---- LINE で入力 ----
    case "reg_name": {
      if (input.kind !== "text" || text.length < 1 || text.length > 100) return retry(ctx, user);
      user.draft.fullName = text;
      return moveTo(ctx, user, "reg_birth_date");
    }

    case "reg_birth_date": {
      const date =
        postback?.name === "birth" && input.kind === "postback" ? (input.params?.date ?? null) : parseDateText(text);
      if (!date || !isValidBirthDate(date)) return retry(ctx, user);
      user.draft.birthDate = date;
      return moveTo(ctx, user, "reg_prefecture_region");
    }

    case "reg_prefecture_region": {
      const typed = input.kind === "text" ? findPrefectureCode(text) : null;
      if (typed) {
        user.draft.prefectureCode = typed;
        return moveTo(ctx, user, "reg_interview_1");
      }
      const region = PREFECTURE_REGIONS.find((r) => postback?.name === "region" && r.key === postback.value);
      if (!region) return retry(ctx, user);
      if (region.codes.length === 1) {
        user.draft.prefectureCode = region.codes[0];
        return moveTo(ctx, user, "reg_interview_1");
      }
      user.draft.region = region.key;
      return moveTo(ctx, user, "reg_prefecture");
    }

    case "reg_prefecture": {
      if (postback?.name === "region" && postback.value === "back") return moveTo(ctx, user, "reg_prefecture_region");
      const code =
        postback?.name === "pref" ? Number(postback.value) : input.kind === "text" ? findPrefectureCode(text) : null;
      if (!code || code < 1 || code > 47) return retry(ctx, user);
      user.draft.prefectureCode = code;
      return moveTo(ctx, user, "reg_interview_1");
    }

    case "reg_interview_1":
    case "reg_interview_2": {
      const which = user.state === "reg_interview_1" ? "interview1" : "interview2";
      const iso = postback?.name === which && input.kind === "postback" ? pickerToIso(input.params?.datetime) : null;
      const invalid =
        !iso || !isSelectableInterviewSlot(iso) || (which === "interview2" && iso === user.draft.interviewAt1);
      if (invalid) {
        return [...messages(ctx, "invalid_interview", { interview_rule: interviewRule() }), ...ask(ctx, user)];
      }
      if (which === "interview1") {
        user.draft.interviewAt1 = iso;
        return moveTo(ctx, user, "reg_interview_2");
      }
      user.draft.interviewAt2 = iso;
      return moveTo(ctx, user, "reg_consent");
    }

    case "reg_consent": {
      if (postback?.name === "consent" && postback.value === "yes") return moveTo(ctx, user, "reg_confirm");
      if (input.kind === "text" && /^同意(する|します)?$/.test(text)) return moveTo(ctx, user, "reg_confirm");
      return ask(ctx, user);
    }

    case "reg_confirm": {
      if (postback?.name === "confirm" && postback.value === "restart") {
        user.draft = {};
        return moveTo(ctx, user, "reg_name");
      }
      if (postback?.name !== "confirm" || postback.value !== "yes") return ask(ctx, user);

      const d = user.draft;
      if (!user.phone || !d.fullName || !d.birthDate || !d.prefectureCode || !d.interviewAt1 || !d.interviewAt2) {
        // 途中の内容が欠けている（想定外）→ 最初から
        user.draft = {};
        return moveTo(ctx, user, "reg_name", messages(ctx, "invalid_input"));
      }
      // 確認の間に日時が範囲外になっていないか
      if (!isSelectableInterviewSlot(d.interviewAt1)) return moveTo(ctx, user, "reg_interview_1");
      if (!isSelectableInterviewSlot(d.interviewAt2)) return moveTo(ctx, user, "reg_interview_2");

      await ctx.store.register({
        fullName: d.fullName,
        birthDate: d.birthDate,
        phone: user.phone,
        prefectureCode: d.prefectureCode,
        interviewAt1: d.interviewAt1,
        interviewAt2: d.interviewAt2,
      });
      user.state = "linked";
      user.draft = {};
      return messages(ctx, "registration_completed");
    }
  }

  return [];
}

async function sendFormLink(ctx: FlowContext, user: LineUserState) {
  const token = await ctx.store.createLinkToken();
  user.state = "choosing_registration";
  return messages(ctx, "registration_form_link", {
    lp_url: `${ctx.siteUrl}/?${LP_UTM}&lt=${encodeURIComponent(token)}#entry`,
  });
}
