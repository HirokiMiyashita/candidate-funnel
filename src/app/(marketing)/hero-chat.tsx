/**
 * ファーストビューのイラスト（装飾）。
 * 「LINE で気軽に相談できる」ことを伝える一般的なチャット画面。LINE の画面を模したものではない。
 */
const MESSAGES = [
  { from: "user", text: "今の仕事を続けるか迷っていて、相談してもいいですか？" },
  { from: "staff", text: "もちろんです。まずは今のお仕事のことを聞かせてください。" },
  { from: "staff", text: "電話での面談は30分ほどです。ご都合のよい日時はありますか？" },
  { from: "user", text: "来週の平日の夜なら大丈夫です！" },
] as const;

export function HeroChat() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm md:rotate-2">
      <div className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_24px_50px_-24px_rgba(18,48,90,0.35)]">
        <div className="flex items-center gap-3 border-b border-ink/10 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
            担
          </span>
          <span>
            <span className="block text-sm font-bold">キャリア担当</span>
            <span className="block text-xs text-mist">相談・紹介は無料です</span>
          </span>
        </div>
        <div className="flex flex-col gap-3 bg-sky/60 px-4 py-5 text-sm leading-6">
          {MESSAGES.map((m, i) => (
            <p
              key={m.text}
              className={`animate-slot-pop max-w-[82%] rounded-2xl px-4 py-2.5 ${
                m.from === "user"
                  ? "self-end rounded-br-md bg-line text-white"
                  : "self-start rounded-bl-md bg-white text-ink"
              }`}
              style={{ animationDelay: `${300 + i * 450}ms`, transformOrigin: m.from === "user" ? "right bottom" : "left bottom" }}
            >
              {m.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
