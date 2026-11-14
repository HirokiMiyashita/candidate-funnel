import { ORPCError } from "@orpc/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { adminPath } from "@/lib/admin-path";
import { ageFromBirthDate, formatJstDateTime } from "@/lib/entry/datetime";
import { api } from "@/lib/orpc/server";
import { prefectureName } from "@/lib/prefectures";
import { statusColorClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { ClickableRow } from "../clickable-row";
import { CandidatePanel } from "./candidate-panel";

type Line = "linked" | "unlinked";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; line?: string; candidate?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 100) || undefined;
  const line: Line | undefined = params.line === "linked" || params.line === "unlinked" ? params.line : undefined;

  const [candidates, statuses] = await Promise.all([api.candidates.list({ q, line }), api.statuses.list()]);
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  // 検索条件を保ったまま右パネルを開閉する URL
  const basePath = adminPath("/dashboard/candidates");
  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (line) listParams.set("line", line);
  const listHref = listParams.size ? `${basePath}?${listParams}` : basePath;
  const hrefFor = (candidateId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("candidate", candidateId);
    return `${basePath}?${p}`;
  };

  let detail: Awaited<ReturnType<typeof api.candidates.detail>> | null = null;
  if (params.candidate && /^[0-9a-f-]{36}$/i.test(params.candidate)) {
    try {
      detail = await api.candidates.detail({ id: params.candidate });
    } catch (e) {
      if (!(e instanceof ORPCError && e.code === "NOT_FOUND")) throw e;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">登録者一覧</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          転職希望者 1 人ずつの一覧です（電話番号が同じ応募は 1 人にまとめています）。
        </p>
      </div>

      {/* 検索・絞り込み（URL のパラメータで保持） */}
      <form action={basePath} className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="名前・電話番号で検索"
          aria-label="名前・電話番号で検索"
          className="w-64"
        />
        <NativeSelect name="line" defaultValue={line ?? ""} aria-label="LINE 連携" className="w-40">
          <option value="">LINE: すべて</option>
          <option value="linked">LINE 連携済み</option>
          <option value="unlinked">LINE 未連携</option>
        </NativeSelect>
        <Button type="submit" variant="outline">
          検索
        </Button>
        {(q || line) && (
          <Link href={basePath} className="text-sm text-muted-foreground underline underline-offset-4">
            条件をクリア
          </Link>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{candidates.length} 人</span>
      </form>

      {candidates.length === 0 ? (
        <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
          {q || line ? "条件に合う登録者はいません。" : "まだ登録者はいません。"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {["氏名", "電話番号", "年齢", "都道府県", "LINE", "応募", "最新の応募", "最初の流入元", "登録日"].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const latestStatus = c.latestApplication ? statusById.get(c.latestApplication.statusId) : undefined;
                return (
                  <ClickableRow key={c.id} href={hrefFor(c.id)} selected={detail?.id === c.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{c.fullName}</span>
                      {c.noteCount > 0 && (
                        <span className="ml-1.5 rounded-full border px-1.5 py-0.5 text-xs text-muted-foreground">
                          メモ {c.noteCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a href={`tel:${c.phone}`} className="underline-offset-4 hover:underline">
                        {c.phone}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.birthDate ? `${ageFromBirthDate(c.birthDate)} 歳` : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.prefectureCode ? prefectureName(c.prefectureCode) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.lineLinked ? (
                        <span className="rounded-full bg-[#06c755] px-2 py-0.5 text-xs font-medium text-white">連携済み</span>
                      ) : (
                        <span className="text-muted-foreground">未連携</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{c.applicationCount} 件</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.latestApplication ? (
                        <span className="flex items-center gap-2">
                          {formatJstDateTime(c.latestApplication.createdAt)}
                          {latestStatus && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs",
                                statusColorClass(latestStatus.color).badge,
                              )}
                            >
                              {latestStatus.name}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{c.firstCampaign ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatJstDateTime(c.createdAt)}</td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && <CandidatePanel detail={detail} statuses={statuses} closeHref={listHref} />}
    </div>
  );
}
