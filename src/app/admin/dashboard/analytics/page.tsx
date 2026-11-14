import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { api } from "@/lib/orpc/server";
import { cn } from "@/lib/utils";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

const PLACEMENT_LABEL: Record<string, string> = {
  hero: "ファーストビュー",
  sticky_bar: "画面下の固定バー",
};
const DEVICE_LABEL: Record<string, string> = { mobile: "スマホ", desktop: "PC" };

function rate(part: number, whole: number) {
  if (!whole) return "—";
  // 訪問の記録が無いままボタンだけ押された場合（計測のブロック等）でも 100% を超えないようにする
  return `${(Math.min(1, part / whole) * 100).toFixed(1)}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days: Period = PERIODS.find((p) => String(p) === daysParam) ?? 30;
  const { rows, totals, breakdown } = await api.analytics.funnel({ days });

  const summary = [
    { label: "訪問者", value: totals.visitors, sub: null },
    { label: "LINE ボタンを押した人", value: totals.lineClicks, sub: rate(totals.lineClicks, totals.visitors) },
    { label: "電話ボタンを押した人", value: totals.telClicks, sub: rate(totals.telClicks, totals.visitors) },
    { label: "フォームで保存した人", value: totals.formSubmits, sub: rate(totals.formSubmits, totals.visitors) },
    { label: "いずれかを行った人", value: totals.converters, sub: rate(totals.converters, totals.visitors) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">流入分析</h1>
        <nav aria-label="集計期間" className="inline-flex rounded-lg border p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`${adminPath("/dashboard/analytics")}?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                p === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              直近 {p} 日
            </Link>
          ))}
        </nav>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border p-4">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{s.value.toLocaleString()}</span>
              {s.sub && <span className="text-sm text-muted-foreground tabular-nums">訪問者の {s.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">流入元ごと</h2>
        <p className="text-sm text-muted-foreground">
          流入元は広告 URL の utm パラメータで判定し、無い場合は参照元のサイト、どちらも無い場合は (direct) になります。
          人数は同じブラウザを 1 人として数えています。
        </p>
        {rows.length === 0 ? (
          <p className="rounded-xl border p-6 text-sm text-muted-foreground">この期間の記録はまだありません。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">流入元</th>
                  <th className="px-3 py-2 font-medium">媒体</th>
                  <th className="px-3 py-2 font-medium">キャンペーン</th>
                  <th className="px-3 py-2 text-right font-medium">訪問者</th>
                  <th className="px-3 py-2 text-right font-medium">LINE</th>
                  <th className="px-3 py-2 text-right font-medium">電話</th>
                  <th className="px-3 py-2 text-right font-medium">フォーム</th>
                  <th className="px-3 py-2 text-right font-medium">いずれかを行った人</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}|${r.medium}|${r.campaign}`} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{r.source}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.medium}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.campaign}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.visitors}</td>
                    <Cell value={r.lineClicks} whole={r.visitors} />
                    <Cell value={r.telClicks} whole={r.visitors} />
                    <Cell value={r.formSubmits} whole={r.visitors} />
                    <Cell value={r.converters} whole={r.visitors} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          「いずれかを行った人」は LINE・電話・フォームのどれかを 1 回以上行った人数です（1 人が複数行っても 1 人と数えます）。
          各列の % は訪問者に対する割合です。
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">ボタンの場所・端末ごと</h2>
        {breakdown.length === 0 ? (
          <p className="rounded-xl border p-6 text-sm text-muted-foreground">この期間のボタン押下はまだありません。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">ボタン</th>
                  <th className="px-3 py-2 font-medium">場所</th>
                  <th className="px-3 py-2 font-medium">端末</th>
                  <th className="px-3 py-2 text-right font-medium">押した人</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b) => (
                  <tr key={`${b.eventType}|${b.placement}|${b.device}`} className="border-t">
                    <td className="px-3 py-2">{b.eventType === "line_click" ? "LINE" : "電話"}</td>
                    <td className="px-3 py-2">{PLACEMENT_LABEL[b.placement] ?? b.placement}</td>
                    <td className="px-3 py-2">{DEVICE_LABEL[b.device] ?? b.device}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.clickers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Cell({ value, whole }: { value: number; whole: number }) {
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
      {value}
      <span className="ml-1.5 text-xs text-muted-foreground">{rate(value, whole)}</span>
    </td>
  );
}
