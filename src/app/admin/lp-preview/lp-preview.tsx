"use client";

import { useEffect, useState } from "react";
import { LandingView, LpFooter, type LpSectionKey } from "@/app/(marketing)/landing-view";
import type { LpContent } from "@/lib/lp-content/schema";

/** 親画面（編集画面）とのメッセージ */
export type LpPreviewMessage =
  | { type: "lp-preview:content"; content: LpContent }
  | { type: "lp-preview:ready" }
  | { type: "lp-preview:select"; section: LpSectionKey };

export function LpPreview({ initial }: { initial: LpContent }) {
  const [content, setContent] = useState(initial);

  useEffect(() => {
    const parentWindow = window.parent;
    if (parentWindow === window) return;

    function onMessage(event: MessageEvent<LpPreviewMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lp-preview:content") setContent(event.data.content);
    }

    // クリックした場所の編集欄を親画面で開く（リンクやフォームは動かさない）
    function onClick(event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-lp-section]");
      const section = target?.dataset.lpSection as LpSectionKey | undefined;
      if (section) {
        parentWindow.postMessage({ type: "lp-preview:select", section } satisfies LpPreviewMessage, window.location.origin);
      }
    }

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    parentWindow.postMessage({ type: "lp-preview:ready" } satisfies LpPreviewMessage, window.location.origin);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <>
      <style>{`
        [data-lp-section] { cursor: pointer; transition: outline-color .15s; outline: 2px solid transparent; outline-offset: -2px; }
        [data-lp-section]:hover { outline-color: rgb(31 122 224 / 0.7); }
        [data-lp-section] [data-lp-section]:hover { outline-offset: 2px; }
        input, select, textarea, button, a { pointer-events: none; }
      `}</style>
      <main>
        <LandingView content={content} initial={null} preview />
      </main>
      <LpFooter companyName={content.basic.companyName} />
    </>
  );
}
