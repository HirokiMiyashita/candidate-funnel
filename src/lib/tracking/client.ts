import type { Attribution } from "@/lib/entry/schema";
import type { TrackEvent, TrackEventType, TrackPlacement } from "./schema";

/**
 * LP の計測（ブラウザ専用）。
 * - 訪問者 ID: ブラウザごとのランダムな ID（localStorage）。個人は特定しない
 * - 流入元: そのセッションで最初に LP を開いたときの URL パラメータと参照元（sessionStorage）。
 *   途中で別の広告パラメータ付き URL から来た場合はそちらで上書きする
 */

const VISITOR_KEY = "cf_vid";
const ATTRIBUTION_KEY = "cf_attr";
const CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

function randomUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // 非 HTTPS 環境などのフォールバック（UUID v4 形式）
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let memoryVisitorId: string | null = null;

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = randomUuid();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    // ストレージが使えない環境ではページを開いている間だけの ID
    memoryVisitorId ??= randomUuid();
    return memoryVisitorId;
  }
}

/** 自サイト以外からの参照元だけを返す */
function externalReferrer(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).origin === window.location.origin ? undefined : document.referrer;
  } catch {
    return undefined;
  }
}

export function getAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const hasCampaign = CAMPAIGN_PARAMS.some((key) => params.get(key));

  if (!hasCampaign) {
    try {
      const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
      if (stored) return JSON.parse(stored) as Attribution;
    } catch {
      // 読めなければ作り直す
    }
  }

  const get = (key: string) => params.get(key)?.slice(0, 255) || undefined;
  const attribution: Attribution = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmTerm: get("utm_term"),
    utmContent: get("utm_content"),
    gclid: get("gclid"),
    fbclid: get("fbclid"),
    referrer: externalReferrer()?.slice(0, 2000),
    landingUrl: window.location.href.slice(0, 2000),
  };

  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // 保存できなくても計測は続ける
  }
  return attribution;
}

function getDevice(): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/** 計測イベントを送る。ページ移動の直前でも届くよう sendBeacon を使う */
export function track(type: TrackEventType, placement?: TrackPlacement) {
  if (typeof window === "undefined") return;

  const event: TrackEvent = {
    visitorId: getVisitorId(),
    type,
    placement,
    device: getDevice(),
    attribution: getAttribution(),
  };
  const body = JSON.stringify(event);

  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // フォールバックへ
  }
  fetch("/api/track", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {});
}
