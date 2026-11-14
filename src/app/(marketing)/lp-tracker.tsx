"use client";

import { useEffect } from "react";
import { track } from "@/lib/tracking/client";
import type { TrackEventType, TrackPlacement } from "@/lib/tracking/schema";

// 開発時の二重実行（React Strict Mode）で訪問が 2 回記録されないようにする
let pageViewSent = false;

/**
 * LP の訪問と、data-track 属性が付いたボタンの押下を記録する。
 * 例: <a data-track="line_click" data-track-placement="hero">
 */
export function LpTracker() {
  useEffect(() => {
    if (!pageViewSent) {
      pageViewSent = true;
      track("page_view");
    }

    function onClick(event: MouseEvent) {
      const el = (event.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el) return;
      track(
        el.dataset.track as TrackEventType,
        el.dataset.trackPlacement as TrackPlacement | undefined,
      );
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
