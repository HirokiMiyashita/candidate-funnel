import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { ageFromBirthDate, formatDate, formatJstDateTime } from "@/lib/entry/datetime";
import type { api } from "@/lib/orpc/server";
import { prefectureName } from "@/lib/prefectures";
import { statusColorClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { NoteDeleteButton, NoteForm } from "./note-form";
import { PanelClose } from "./panel-close";
import { StatusSelect } from "./status-select";

type Detail = Awaited<ReturnType<typeof api.applications.detail>>;
type StatusOption = { id: string; name: string; color: string };

/** 応募一覧の右パネル（その人の情報・この応募・他の応募・メモ） */
export function ApplicationPanel({
  detail: d,
  statuses,
  closeHref,
  hrefFor,
}: {
  detail: Detail;
  statuses: StatusOption[];
  closeHref: string;
  /** 他の応募のパネルを開く URL */
  hrefFor: (applicationId: string) => string;
}) {
  const c = d.candidate;
  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const inputDiffers =
    d.input.fullName !== c.fullName || d.input.phone !== c.phone || d.input.prefectureCode !== c.prefectureCode;

  return (
    <aside
      aria-label={`${c.fullName} さんの詳細`}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l bg-background shadow-xl"
    >
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{c.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            {formatJstDateTime(d.createdAt)} の応募{d.channel === "line" && "（LINE）"}
            <Link
              href={`${adminPath("/dashboard/candidates")}?candidate=${c.id}`}
              className="ml-2 underline underline-offset-4 hover:text-foreground"
            >
              登録者一覧で見る
            </Link>
          </p>
        </div>
        <PanelClose href={closeHref} />
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        <section className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">ステータス</span>
          {/* key: 別の応募に切り替えたとき・一覧側で変更したときに作り直す */}
          <StatusSelect key={`${d.id}:${d.statusId}`} applicationId={d.id} personName={c.fullName} statusId={d.statusId} options={statuses} />
        </section>

        <Section title="その人の情報">
          <Info label="電話番号">
            <a href={`tel:${c.phone}`} className="font-medium underline-offset-4 hover:underline">
              {c.phone}
            </a>
          </Info>
          <Info label="生年月日">
            {c.birthDate ? `${formatDate(c.birthDate)}（${ageFromBirthDate(c.birthDate)} 歳）` : "—"}
          </Info>
          <Info label="都道府県">{c.prefectureCode ? prefectureName(c.prefectureCode) : "—"}</Info>
          <Info label="LINE">
            {c.lineLinked
              ? `連携済み${c.lineLinkedAt ? `（${formatJstDateTime(c.lineLinkedAt)}）` : ""}`
              : "未連携"}
          </Info>
          {inputDiffers && (
            <p className="mt-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              この応募での入力: {d.input.fullName} / {d.input.phone} /{" "}
              {prefectureName(d.input.prefectureCode)}
            </p>
          )}
        </Section>

        <Section title="この応募">
          <Info label="第1希望">{formatJstDateTime(d.interviewAt1)}</Info>
          <Info label="第2希望">{formatJstDateTime(d.interviewAt2)}</Info>
          <Info label="流入元">
            {[d.attribution.utmSource, d.attribution.utmMedium, d.attribution.utmCampaign].filter(Boolean).join(" / ") ||
              "—"}
            {d.attribution.utmContent && (
              <span className="block text-xs text-muted-foreground">utm_content: {d.attribution.utmContent}</span>
            )}
          </Info>
          {d.attribution.referrer && <Info label="参照元">{d.attribution.referrer}</Info>}
          <Info label="LP のボタン">
            {d.lineClickedAt || d.telClickedAt ? (
              <span className="flex flex-col">
                {d.lineClickedAt && <span>LINE: {formatJstDateTime(d.lineClickedAt)}</span>}
                {d.telClickedAt && <span>電話: {formatJstDateTime(d.telClickedAt)}</span>}
              </span>
            ) : (
              "押していない（または別の端末）"
            )}
          </Info>
        </Section>

        {d.siblings.length > 1 && (
          <Section title={`この人の応募（${d.siblings.length} 件）`}>
            <ul className="flex flex-col divide-y rounded-lg border">
              {d.siblings.map((s) => {
                const status = statusById.get(s.statusId);
                const current = s.id === d.id;
                return (
                  <li key={s.id}>
                    <Link
                      href={hrefFor(s.id)}
                      scroll={false}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50",
                        current && "bg-muted/60 font-medium",
                      )}
                    >
                      <span className="whitespace-nowrap">{formatJstDateTime(s.createdAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.campaign}</span>
                      {status && (
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs", statusColorClass(status.color).badge)}>
                          {status.name}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title={`メモ（${d.notes.length}）`}>
          <NoteForm key={d.id} candidateId={c.id} applicationId={d.id} />
          {d.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだメモはありません。電話の結果や日程調整の経緯を残しておけます。</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {d.notes.map((n) => (
                <li key={n.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{n.authorEmail}</span>
                    <span>{formatJstDateTime(n.createdAt)}</span>
                    {n.applicationId && n.applicationId !== d.id && <span>（別の応募で記入）</span>}
                    {n.isMine && (
                      <span className="ml-auto">
                        <NoteDeleteButton id={n.id} />
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
