import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { formatJstDateTime } from "@/lib/entry/datetime";
import { api } from "@/lib/orpc/server";
import { prefectureName } from "@/lib/prefectures";
import { statusColorClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { ORPCError } from "@orpc/server";
import { ApplicationPanel } from "./application-panel";
import { ClickableRow } from "./clickable-row";
import { SourceFilter } from "./source-filter";
import { StatusSelect } from "./status-select";

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; application?: string }>;
}) {
  const { status, source, application } = await searchParams;
  const [statuses, campaigns] = await Promise.all([api.statuses.list(), api.applications.campaigns()]);
  // 存在しないステータス・流入元が指定された場合は「すべて」
  const current = statuses.find((s) => s.id === status);
  const currentSource = campaigns.find((c) => c.key === source);
  const applications = await api.applications.list({ statusId: current?.id, campaign: currentSource?.key });
  const total = statuses.reduce((sum, s) => sum + s.usage, 0);
  const options = statuses.map(({ id, name, color }) => ({ id, name, color }));
  const basePath = adminPath("/dashboard");

  // 絞り込み（ステータス・流入元）を保った URL を作る
  const buildHref = (next: { status?: string | null; source?: string | null; application?: string }) => {
    const p = new URLSearchParams();
    const st = next.status === undefined ? current?.id : next.status;
    const so = next.source === undefined ? currentSource?.key : next.source;
    if (st) p.set("status", st);
    if (so) p.set("source", so);
    if (next.application) p.set("application", next.application);
    return p.size ? `${basePath}?${p}` : basePath;
  };
  const listHref = buildHref({});
  const hrefFor = (applicationId: string) => buildHref({ application: applicationId });
  const sourceHrefs: Record<string, string> = Object.fromEntries([
    ["", buildHref({ source: null })],
    ...campaigns.map((c) => [c.key, buildHref({ source: c.key })]),
  ]);

  // 右パネル（?application=<id>）
  let detail: Awaited<ReturnType<typeof api.applications.detail>> | null = null;
  if (application && /^[0-9a-f-]{36}$/i.test(application)) {
    try {
      detail = await api.applications.detail({ id: application });
    } catch (e) {
      if (!(e instanceof ORPCError && e.code === "NOT_FOUND")) throw e;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">応募一覧</h1>
        <Link href={adminPath("/dashboard/statuses")} className="text-sm underline underline-offset-4">
          ステータスを編集
        </Link>
      </div>

      {/* ステータスで絞り込み */}
      <nav aria-label="絞り込み" className="flex flex-wrap items-center gap-2">
        <FilterChip href={buildHref({ status: null })} active={!current} label="すべて" count={total} />
        {statuses.map((s) => (
          <FilterChip
            key={s.id}
            href={buildHref({ status: s.id })}
            active={current?.id === s.id}
            label={s.name}
            count={s.usage}
            dotClass={statusColorClass(s.color).dot}
          />
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <SourceFilter options={campaigns} value={currentSource?.key} hrefFor={sourceHrefs} />
      </nav>

      {applications.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          {current || currentSource ? "条件に合う応募はありません。" : "まだ応募はありません。"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {["応募日時", "氏名", "電話番号", "都道府県", "第1希望", "第2希望", "流入元", "LINE・電話", "ステータス"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <ClickableRow
                  key={a.id}
                  href={hrefFor(a.id)}
                  selected={detail?.id === a.id}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatJstDateTime(a.createdAt)}
                    {a.channel === "line" && <span className="ml-1.5 text-xs text-muted-foreground">LINE</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium">{a.candidate.fullName}</span>
                    {a.candidate.applicationCount > 1 && (
                      <span
                        title="同じ電話番号の人からの応募の件数"
                        className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        応募 {a.candidate.applicationCount} 件
                      </span>
                    )}
                    {a.candidate.noteCount > 0 && (
                      <span
                        title="メモの件数"
                        className="ml-1.5 rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        メモ {a.candidate.noteCount}
                      </span>
                    )}
                    {a.input.fullName !== a.candidate.fullName && (
                      <span className="block text-xs text-muted-foreground">この応募での入力: {a.input.fullName}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <a href={`tel:${a.candidate.phone}`} className="underline-offset-4 hover:underline">
                      {a.candidate.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.candidate.prefectureCode ? prefectureName(a.candidate.prefectureCode) : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatJstDateTime(a.interviewAt1)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatJstDateTime(a.interviewAt2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {[a.utmSource, a.utmMedium, a.utmCampaign].filter(Boolean).join(" / ") || "—"}
                    {a.previousOtherCampaigns.length > 0 && (
                      <span
                        title={`以前の応募の広告: ${a.previousOtherCampaigns.join("、")}`}
                        className="mt-1 block w-fit rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
                      >
                        別の広告から再応募
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <ContactClicks
                      lineClickedAt={a.lineClickedAt}
                      telClickedAt={a.telClickedAt}
                      lineLinked={a.candidate.lineLinked}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusSelect
                      // パネル側で変更したときも最新の値で作り直す
                      key={`${a.id}:${a.statusId}`}
                      applicationId={a.id}
                      personName={a.candidate.fullName}
                      statusId={a.statusId}
                      options={options}
                    />
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <ApplicationPanel detail={detail} statuses={options} closeHref={listHref} hrefFor={hrefFor} />
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  count,
  dotClass,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  dotClass?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {dotClass && <span className={cn("size-2 rounded-full", dotClass)} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{count}</span>
    </Link>
  );
}

/** LP で LINE・電話ボタンを押したか（同じブラウザでの記録）と LINE 連携の有無 */
function ContactClicks({
  lineClickedAt,
  telClickedAt,
  lineLinked,
}: {
  lineClickedAt: string | null;
  telClickedAt: string | null;
  /** LINE で電話番号の照合ができている（LINE ユーザー ID が登録済み） */
  lineLinked: boolean;
}) {
  if (!lineClickedAt && !telClickedAt && !lineLinked) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex gap-1.5">
      {lineLinked && (
        <span title="LINE で本人確認済み" className="rounded-full bg-[#06c755] px-2 py-0.5 text-xs font-medium text-white">
          LINE 連携済み
        </span>
      )}
      {lineClickedAt && (
        <span
          title={`LINE ボタン: ${formatJstDateTime(lineClickedAt)}`}
          className="rounded-full bg-[#06c755]/10 px-2 py-0.5 text-xs font-medium text-[#05873a]"
        >
          LINE
        </span>
      )}
      {telClickedAt && (
        <span
          title={`電話ボタン: ${formatJstDateTime(telClickedAt)}`}
          className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
        >
          電話
        </span>
      )}
    </span>
  );
}
