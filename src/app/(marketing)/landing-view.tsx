import type { EntryFormInitial } from "@/lib/entry/types";
import type { LpContent } from "@/lib/lp-content/schema";
import { ContactButtons, telHref } from "./contact-buttons";
import { EntryForm } from "./entry-form";
import { HeroChat } from "./hero-chat";
import { LpTracker } from "./lp-tracker";
import { MobileEntryBar } from "./mobile-entry-bar";

/** LP 管理画面のプレビューで「どこを編集するか」を示すセクション名 */
export type LpSectionKey = "basic" | "hero" | "contact" | "forYou" | "steps" | "entry" | "faq";

/**
 * LP の本体（表示のみ）。公開ページと管理画面のプレビューで共用する。
 * data-lp-section はプレビューでクリックした場所の編集欄を開くための目印。
 */
export function LandingView({
  content: c,
  initial,
  entryMode = "edit",
  preview = false,
}: {
  content: LpContent;
  initial: EntryFormInitial | null;
  /** edit: 前回の応募を編集 / new: 前回の入力内容を使って新しい応募（違う広告から来た場合） */
  entryMode?: "edit" | "new";
  /** 管理画面のプレビュー表示（フォームは保存しない） */
  preview?: boolean;
}) {
  const formLinkLabel = initial && entryMode === "edit" ? c.hero.formLinkEdit : c.hero.formLink;

  return (
    <>
      {/* ファーストビュー */}
      <section className="bg-sky">
        <div className="mx-auto max-w-6xl px-5">
          <header className="flex h-16 items-center">
            <span data-lp-section="basic" className="text-lg font-bold">{c.basic.serviceName}</span>
          </header>

          <div className="grid gap-12 pt-8 pb-16 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-16 md:pt-14 md:pb-24">
            <div data-lp-section="hero">
              <h1 className="text-[2.125rem] leading-[1.4] font-black tracking-tight sm:text-5xl sm:leading-[1.3] lg:text-[3.75rem] lg:leading-[1.25]">
                {c.hero.title.map((phrase, i) => (
                  <span key={i} className="inline-block">
                    {phrase}
                  </span>
                ))}
              </h1>
              <p className="mt-6 max-w-[32em] text-base leading-8 text-ink/80 md:text-lg md:leading-9">
                {c.hero.lead}
              </p>
              <div id="hero-cta" data-lp-section="contact" className="mt-9">
                <ContactButtons contact={c.contact} />
                <p className="mt-3 text-sm text-mist">{c.contact.phoneHours}</p>
                <a
                  href="#entry"
                  className="mt-4 inline-block text-sm font-bold text-brand underline underline-offset-4 hover:no-underline"
                >
                  {formLinkLabel}
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/75">
                {c.hero.notes.map((note, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-brand" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
            <div className="hidden md:block">
              <HeroChat />
            </div>
          </div>
        </div>
      </section>

      {/* こんな方へ */}
      <section data-lp-section="forYou" className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl leading-snug font-bold md:text-[2rem]">{c.forYou.title}</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-4 md:grid-cols-2">
            {c.forYou.items.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-b border-ink/10 pb-4 text-base leading-7 md:text-lg"
              >
                <CheckIcon className="mt-1 size-5 shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 流れ（順番がある内容なので番号付き） */}
      <section data-lp-section="steps" className="bg-sky px-5 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl leading-snug font-bold md:text-[2rem]">{c.steps.title}</h2>
          <ol className="relative mt-10 grid gap-8 md:grid-cols-4 md:gap-6">
            {/* つなぎの線 */}
            <span
              aria-hidden="true"
              className="absolute top-2 bottom-2 left-5 w-px bg-brand/30 md:top-5 md:right-[12.5%] md:bottom-auto md:left-[12.5%] md:h-px md:w-auto"
            />
            {c.steps.items.map((step, i) => (
              <li key={i} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-7 text-mist md:mt-2">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* フォーム */}
      <section id="entry" data-lp-section="entry" className="relative scroll-mt-4 px-5 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <h2 className="text-2xl leading-snug font-bold md:text-[2rem]">{c.entry.title}</h2>
            <p className="mt-4 leading-8 text-mist">{c.entry.body}</p>
            <ul className="mt-6 hidden gap-3 md:grid">
              {c.entry.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-7">
                  <CheckIcon className="mt-1 size-4 shrink-0 text-brand" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_2px_0_rgba(20,33,61,0.06)] sm:p-8">
            <EntryForm initial={initial} mode={entryMode} preview={preview} />
          </div>
        </div>
      </section>

      {/* よくある質問 */}
      <section data-lp-section="faq" className="bg-sky px-5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl leading-snug font-bold md:text-[2rem]">{c.faq.title}</h2>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {c.faq.items.map((item, i) => (
              <details key={i} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-bold focus-visible:ring-[3px] focus-visible:ring-ink/30 focus-visible:outline-none md:text-lg [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="relative size-4 shrink-0 before:absolute before:top-1/2 before:left-0 before:h-0.5 before:w-4 before:-translate-y-1/2 before:bg-ink after:absolute after:top-0 after:left-1/2 after:h-4 after:w-0.5 after:-translate-x-1/2 after:bg-ink after:transition-transform group-open:after:scale-y-0"
                  />
                </summary>
                <p className="pb-5 leading-8 text-mist">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 計測（管理画面のプレビューでは記録しない） */}
      {!preview && <LpTracker />}

      <MobileEntryBar
        lineUrl={c.contact.lineUrl}
        lineLabel={c.contact.lineLabel}
        telHref={telHref(c.contact.phoneNumber)}
      />
    </>
  );
}

export function LpFooter({ companyName }: { companyName: string }) {
  return (
    <footer
      data-lp-section="basic"
      className="border-t border-ink/10 bg-white px-5 pt-10 pb-28 text-sm text-mist md:pb-10"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>運営：{companyName}</p>
        <div className="flex gap-6">
          <a href="/privacy" className="underline-offset-4 hover:underline">
            プライバシーポリシー
          </a>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-xs text-mist/80">© {companyName}</p>
    </footer>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
