import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { FlowInput, OutMessage, QuickReplyItem } from "./types";

/** LINE の Webhook の署名（x-line-signature）を確認する */
export function verifyLineSignature(body: string, signature: string | null, channelSecret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(body).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** LINE の Webhook のイベント（使う部分だけ） */
export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string; params?: { date?: string; datetime?: string } };
};

/** LINE のイベントをアプリ内部の形に（対象外なら null） */
export function toFlowInput(event: LineWebhookEvent): FlowInput | null {
  switch (event.type) {
    case "follow":
      return { kind: "follow" };
    case "unfollow":
      return { kind: "unfollow" };
    case "message":
      // 文字以外（スタンプ・画像など）は空の文字として扱う（入力中なら聞き直す）
      return { kind: "text", text: event.message?.type === "text" ? (event.message.text ?? "") : "" };
    case "postback":
      return event.postback ? { kind: "postback", data: event.postback.data, params: event.postback.params } : null;
    default:
      return null;
  }
}

const LABEL_MAX = 20;
const QUICK_REPLY_MAX = 13;
const MESSAGES_PER_REPLY = 5;
const TEXT_MAX = 5000;

function toLineAction(item: QuickReplyItem) {
  const label = item.label.slice(0, LABEL_MAX);
  switch (item.type) {
    case "postback":
      return { type: "postback", label, data: item.data, displayText: item.displayText };
    case "datetimepicker":
      return {
        type: "datetimepicker",
        label,
        data: item.data,
        mode: item.mode,
        ...(item.initial && { initial: item.initial }),
        ...(item.min && { min: item.min }),
        ...(item.max && { max: item.max }),
      };
    case "uri":
      return { type: "uri", label, uri: item.uri };
  }
}

/** アプリ内部のメッセージを LINE の API の形式に */
export function toLineMessages(messages: OutMessage[]) {
  return messages.slice(0, MESSAGES_PER_REPLY).map((m) => ({
    type: "text" as const,
    text: m.text.slice(0, TEXT_MAX),
    ...(m.quickReply?.length && {
      quickReply: {
        items: m.quickReply.slice(0, QUICK_REPLY_MAX).map((item) => ({ type: "action", action: toLineAction(item) })),
      },
    }),
  }));
}

/** 返信（Reply API。無料で送れる） */
export async function replyLineMessages(replyToken: string, messages: OutMessage[], accessToken: string) {
  if (messages.length === 0) return;
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages: toLineMessages(messages) }),
  });
  if (!res.ok) {
    console.error("LINE reply failed", res.status, await res.text());
  }
}
