import { createAdminClient } from "@/lib/supabase/admin";
import { trackEventSchema } from "@/lib/tracking/schema";

const MAX_BODY_LENGTH = 8_000;
/** 明らかなクローラーは記録しない */
const BOT_PATTERN = /bot|crawler|spider|crawling|headless|lighthouse|preview/i;

/** LP の計測イベントを受け取って保存する（未ログイン可） */
export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_PATTERN.test(userAgent)) return new Response(null, { status: 204 });

  const text = await request.text();
  if (text.length > MAX_BODY_LENGTH) return new Response(null, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = trackEventSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { visitorId, type, placement, device, attribution: a = {} } = parsed.data;
  const { error } = await createAdminClient()
    .from("lp_events")
    .insert({
      visitor_id: visitorId,
      event_type: type,
      placement: placement ?? null,
      device: device ?? null,
      utm_source: a.utmSource || null,
      utm_medium: a.utmMedium || null,
      utm_campaign: a.utmCampaign || null,
      utm_term: a.utmTerm || null,
      utm_content: a.utmContent || null,
      gclid: a.gclid || null,
      fbclid: a.fbclid || null,
      referrer: a.referrer || null,
      landing_url: a.landingUrl || null,
    });

  if (error) {
    console.error(error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
