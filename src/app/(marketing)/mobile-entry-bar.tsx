"use client";

import { useEffect, useState } from "react";

/**
 * スマホ用の画面下固定バー（LINE・電話）。
 * ファーストビューのボタンとフォームが画面外にあるときだけ表示する。
 */
export function MobileEntryBar({
  lineUrl,
  lineLabel,
  telHref,
}: {
  lineUrl: string;
  lineLabel: string;
  telHref: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = ["hero-cta", "entry"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const inView = new Map<Element, boolean>();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => inView.set(entry.target, entry.isIntersecting));
      setVisible(![...inView.values()].some(Boolean));
    });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const tabIndex = visible ? 0 : -1;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 p-3 backdrop-blur transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-track="line_click"
          data-track-placement="sticky_bar"
          tabIndex={tabIndex}
          className="flex h-12 items-center justify-center rounded-full bg-line text-base font-bold text-white focus-visible:ring-[3px] focus-visible:ring-line/40 focus-visible:outline-none"
        >
          {lineLabel}
        </a>
        <a
          href={telHref}
          data-track="tel_click"
          data-track-placement="sticky_bar"
          tabIndex={tabIndex}
          aria-label="電話で相談する"
          className="flex h-12 items-center justify-center rounded-full border-2 border-ink px-5 text-base font-bold text-ink focus-visible:ring-[3px] focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          電話
        </a>
      </div>
    </div>
  );
}
