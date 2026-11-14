"use client";

import { useRouter } from "next/navigation";

/**
 * クリックで右パネルを開く表の行。
 * 行の中のリンク・ボタン・選択欄の操作では開かない。
 */
export function ClickableRow({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function open() {
    router.push(href, { scroll: false });
  }

  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, select, input, textarea")) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`cursor-pointer border-t align-top outline-none hover:bg-muted/40 focus-visible:bg-muted/60 ${
        selected ? "bg-muted/70 hover:bg-muted/70" : ""
      }`}
    >
      {children}
    </tr>
  );
}
