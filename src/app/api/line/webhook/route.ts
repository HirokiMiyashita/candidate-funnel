import { handleLineInput } from "@/server/line/flow";
import { replyLineMessages, toFlowInput, verifyLineSignature, type LineWebhookEvent } from "@/server/line/api";
import { createLineStore, loadTemplateRows } from "@/server/line/store";
import { resolveTemplates } from "@/server/line/templates";

/**
 * LINE の Webhook（LINE Developers の Messaging API 設定に登録する URL: https://<ドメイン>/api/line/webhook）
 * 署名を確認し、イベントごとに会話の処理をして返信する。
 */
export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelSecret || !accessToken) {
    console.error("LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN が未設定です");
    return new Response("LINE is not configured", { status: 503 });
  }

  const body = await request.text();
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"), channelSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let events: LineWebhookEvent[] = [];
  try {
    events = (JSON.parse(body) as { events?: LineWebhookEvent[] }).events ?? [];
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const templates = resolveTemplates(await loadTemplateRows());
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  // LINE の「Verify」ボタンは events が空で届く → 200 を返すだけ
  for (const event of events) {
    const lineUserId = event.source?.type === "user" ? event.source.userId : undefined;
    const input = toFlowInput(event);
    if (!lineUserId || !input) continue;

    try {
      const replies = await handleLineInput(
        { store: createLineStore(lineUserId), templates, siteUrl, lineUserId },
        input,
      );
      if (event.replyToken) await replyLineMessages(event.replyToken, replies, accessToken);
    } catch (e) {
      // 1 件の失敗で他のイベントを止めない。LINE には 200 を返す（再送の嵐を避ける）
      console.error("LINE event failed", e);
    }
  }

  return new Response("OK");
}
