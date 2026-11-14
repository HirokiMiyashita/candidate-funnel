import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { ageFromBirthDate, formatDate, formatJstDateTime } from "@/lib/entry/datetime";
import type { api } from "@/lib/orpc/server";
import { prefectureName } from "@/lib/prefectures";
import { statusColorClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { NoteDeleteButton, NoteForm } from "../note-form";
import { PanelClose } from "../panel-close";

type Detail = Awaited<ReturnType<typeof api.candidates.detail>>;
type StatusOption = { id: string; name: string; color: string };

/** 登録者一覧の右パネル（その人の情報・応募の履歴・メモ） */
export function CandidatePanel({
  detail: c,
  statuses,
  closeHref,
}: {
  detail: Detail;
  statuses: StatusOption[];
  closeHref: string;
}) {
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  return (
    <aside
      aria-label={`${c.fullName} さんの詳細`}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l bg-background shadow-xl"
    >
      <header className="flex items-start gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{c.fullName}</h2>
          <p className="text-sm text-muted-foreground">{formatJstDateTime(c.createdAt)} に登録</p>
        </div>
        <PanelClose href={closeHref} />
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
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
        </Section>

        <Section title={`応募の履歴（${c.applications.length} 件）`}>
          {c.applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">応募はありません。</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {c.applications.map((a) => {
                const status = statusById.get(a.statusId);
                return (
                  <li key={a.id}>
                    <Link
                      href={`${adminPath("/dashboard")}?application=${a.id}`}
                      title="応募一覧でこの応募を開く"
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <span className="whitespace-nowrap">{formatJstDateTime(a.createdAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {a.channel === "line" ? "LINE" : a.campaign}
                      </span>
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
          )}
        </Section>

        <Section title={`メモ（${c.notes.length}）`}>
          <NoteForm key={c.id} candidateId={c.id} />
          {c.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">まだメモはありません。</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {c.notes.map((n) => (
                <li key={n.id} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>{n.authorEmail}</span>
                    <span>{formatJstDateTime(n.createdAt)}</span>
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
