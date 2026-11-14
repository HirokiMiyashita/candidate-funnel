/** LINE の会話処理で使う型（LINE の API の形式に依存しない、アプリ内部の表現） */

export type LineState =
  | "awaiting_phone"
  | "choosing_registration"
  | "reg_name"
  | "reg_birth_date"
  | "reg_prefecture_region"
  | "reg_prefecture"
  | "reg_interview_1"
  | "reg_interview_2"
  | "reg_consent"
  | "reg_confirm"
  | "linked"
  | "locked";

/** LINE から届いた出来事 */
export type FlowInput =
  | { kind: "follow" }
  | { kind: "unfollow" }
  | { kind: "text"; text: string }
  | { kind: "postback"; data: string; params?: { date?: string; datetime?: string } };

/** 返信のメッセージに付けるボタン（LINE のクイックリプライ） */
export type QuickReplyItem =
  | { type: "postback"; label: string; data: string; displayText: string }
  | {
      type: "datetimepicker";
      label: string;
      data: string;
      mode: "date" | "datetime";
      initial?: string;
      min?: string;
      max?: string;
    }
  | { type: "uri"; label: string; uri: string };

export type OutMessage = { text: string; quickReply?: QuickReplyItem[] };

/** LINE で入力中の内容 */
export type LineDraft = {
  fullName?: string;
  birthDate?: string;
  region?: string;
  prefectureCode?: number;
  interviewAt1?: string;
  interviewAt2?: string;
};
