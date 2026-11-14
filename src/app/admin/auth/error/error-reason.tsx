"use client";

import { useSyncExternalStore } from "react";

const MESSAGES: Record<string, string> = {
  otp_expired:
    "リンクの有効期限が切れているか、すでに使われています。招待した方に、もう一度招待メールを送ってもらってください。",
  access_denied: "リンクが無効です。招待した方に、もう一度招待メールを送ってもらってください。",
};

const DEFAULT_MESSAGE = "リンクが無効か、有効期限が切れています。もう一度メールのリンクを開くか、招待し直してもらってください。";

/**
 * エラーの理由に応じた説明。
 * 理由はクエリ（?reason=）か、Supabase から戻ってきたときの URL の # 以降（error_code=）に入る。
 */
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function ErrorReason({ reason }: { reason?: string }) {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const params = new URLSearchParams(hash.slice(1));
  const code = reason ?? params.get("error_code") ?? params.get("error") ?? undefined;

  return <p className="max-w-md text-sm text-muted-foreground">{(code && MESSAGES[code]) ?? DEFAULT_MESSAGE}</p>;
}
