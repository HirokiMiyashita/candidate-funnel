"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 右パネルの閉じるボタン（Esc キーでも閉じる） */
export function PanelClose({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key === "Escape" && !target?.closest("input, textarea, select")) {
        router.push(href, { scroll: false });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [href, router]);

  return (
    <Link
      href={href}
      scroll={false}
      aria-label="閉じる"
      title="閉じる（Esc）"
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-4" aria-hidden="true">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </Link>
  );
}
