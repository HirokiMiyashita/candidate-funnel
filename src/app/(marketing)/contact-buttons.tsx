import type { LpContent } from "@/lib/lp-content/schema";
import type { TrackPlacement } from "@/lib/tracking/schema";

/** tel: リンク用に数字（と先頭の +）だけを残す */
export function telHref(phoneNumber: string) {
  return `tel:${phoneNumber.replace(/[^\d+]/g, "")}`;
}

/**
 * LINE・電話の問い合わせボタン。
 * LINE のボタン色は LINE のブランドカラー（#06C755）。
 * ロゴを使う場合は LINE の公式素材とガイドラインに従うこと。
 */
export function ContactButtons({
  contact,
  size = "lg",
  placement = "hero",
}: {
  contact: LpContent["contact"];
  size?: "lg" | "sm";
  /** 計測用の設置場所 */
  placement?: TrackPlacement;
}) {
  const height = size === "lg" ? "h-14 text-lg" : "h-12 text-base";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href={contact.lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-track="line_click"
        data-track-placement={placement}
        className={`inline-flex ${height} items-center justify-center gap-2.5 rounded-full bg-line px-7 whitespace-nowrap font-bold text-white shadow-[0_6px_0_#04a044] transition-colors hover:bg-[#05b34c] focus-visible:ring-4 focus-visible:ring-line/40 focus-visible:outline-none active:translate-y-1 active:shadow-[0_2px_0_#04a044]`}
      >
        <ChatIcon className="size-6" />
        {contact.lineLabel}
      </a>
      <a
        href={telHref(contact.phoneNumber)}
        data-track="tel_click"
        data-track-placement={placement}
        className={`inline-flex ${height} items-center justify-center gap-2.5 rounded-full border-2 border-ink bg-white px-7 whitespace-nowrap font-bold text-ink transition-colors hover:bg-ink/5 focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none`}
      >
        <PhoneIcon className="size-5" />
        <span className="sm:hidden">{contact.phoneLabel}</span>
        <span className="hidden tabular-nums sm:inline">{contact.phoneLabel}</span>
      </a>
    </div>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.62 1.58 4.94 4.02 6.4-.17.98-.62 2.2-1.52 3.1 1.9-.14 3.55-.9 4.62-1.73.92.15 1.88.23 2.88.23 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}

export function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11.5 11.5 0 006.2 6.2l1.4-2.1 4.2 1.6V18a2.5 2.5 0 01-2.7 2.5C9.9 19.9 4.1 14.1 3.5 7.2A2.5 2.5 0 015 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
