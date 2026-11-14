"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { interviewDateRange, interviewTimeSlots } from "@/lib/entry/constants";
import { toJstIso } from "@/lib/entry/datetime";
import { entryInputSchema } from "@/lib/entry/schema";
import type { EntryFormInitial } from "@/lib/entry/types";
import { orpc } from "@/lib/orpc/client";
import { getAttribution, getLineLinkToken, getVisitorId, track } from "@/lib/tracking/client";
import { PREFECTURES } from "@/lib/prefectures";

type FieldName =
  | "fullName"
  | "birthDate"
  | "phone"
  | "prefectureCode"
  | "interviewAt1"
  | "interviewAt2"
  | "privacyConsent";

type FieldErrors = Partial<Record<FieldName, string>>;

const TIME_SLOTS = interviewTimeSlots();

/** スマホで押しやすい高さ・文字サイズ（16px 未満だと iOS で入力時に拡大される） */
const CONTROL = "h-12 bg-white text-base md:text-base";

// TODO: デザイン本実装（仮の骨組み）
export function EntryForm({
  initial,
  mode = "edit",
  preview = false,
}: {
  initial: EntryFormInitial | null;
  /** edit: 前回の応募を編集 / new: 前回の入力内容（面談日時以外）を使って新しい応募 */
  mode?: "edit" | "new";
  /** 管理画面のプレビュー（保存しない） */
  preview?: boolean;
}) {
  const [values, setValues] = useState({
    fullName: initial?.fullName ?? "",
    birthDate: initial?.birthDate ?? "",
    phone: initial?.phone ?? "",
    prefectureCode: initial ? String(initial.prefectureCode) : "",
    // 新しい応募のときは面談の日時を選び直してもらう
    interview1Date: (mode === "edit" && initial?.interview1.date) || "",
    interview1Time: (mode === "edit" && initial?.interview1.time) || "",
    interview2Date: (mode === "edit" && initial?.interview2.date) || "",
    interview2Time: (mode === "edit" && initial?.interview2.time) || "",
    privacyConsent: initial !== null,
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isEdit, setIsEdit] = useState(initial !== null && mode === "edit");
  const [dateRange] = useState(() => interviewDateRange());

  const mutation = useMutation(
    orpc.entry.save.mutationOptions({
      onSuccess: (result) => {
        setIsEdit(true);
        if (result.status === "created") track("form_submit");
      },
    }),
  );

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) return;
    mutation.reset();

    const result = entryInputSchema.safeParse({
      fullName: values.fullName,
      birthDate: values.birthDate,
      phone: values.phone,
      prefectureCode: values.prefectureCode ? Number(values.prefectureCode) : 0,
      interviewAt1:
        values.interview1Date && values.interview1Time
          ? toJstIso(values.interview1Date, values.interview1Time)
          : "",
      interviewAt2:
        values.interview2Date && values.interview2Time
          ? toJstIso(values.interview2Date, values.interview2Time)
          : "",
      privacyConsent: values.privacyConsent,
      website: values.website,
      attribution: getAttribution(),
      visitorId: getVisitorId(),
      lineLinkToken: getLineLinkToken(),
    });

    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as FieldName | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    mutation.mutate(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 text-left">
      {isEdit && !mutation.isSuccess && (
        <p className="rounded-xl bg-sky px-4 py-3 text-sm leading-6">
          前回の入力内容を表示しています。変更して保存できます。
        </p>
      )}
      {initial && mode === "new" && !mutation.isSuccess && (
        <p className="rounded-xl bg-sky px-4 py-3 text-sm leading-6">
          前回入力いただいた内容を入れています。面談の希望日時を選んで保存してください。
        </p>
      )}

      <Field label="氏名" htmlFor="fullName" error={errors.fullName}>
        <Input
          className={CONTROL}
          id="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          aria-invalid={!!errors.fullName}
        />
      </Field>

      <Field label="生年月日" htmlFor="birthDate" error={errors.birthDate}>
        <Input
          className={CONTROL}
          id="birthDate"
          type="date"
          autoComplete="bday"
          value={values.birthDate}
          onChange={(e) => update("birthDate", e.target.value)}
          aria-invalid={!!errors.birthDate}
        />
      </Field>

      <Field label="電話番号" htmlFor="phone" error={errors.phone}>
        <Input
          className={CONTROL}
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="09012345678"
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
          aria-invalid={!!errors.phone}
        />
      </Field>

      <Field label="お住まいの都道府県" htmlFor="prefectureCode" error={errors.prefectureCode}>
        <NativeSelect
          className={CONTROL}
          id="prefectureCode"
          value={values.prefectureCode}
          onChange={(e) => update("prefectureCode", e.target.value)}
          aria-invalid={!!errors.prefectureCode}
        >
          <option value="">選択してください</option>
          {PREFECTURES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {([1, 2] as const).map((n) => {
        const dateKey = `interview${n}Date` as const;
        const timeKey = `interview${n}Time` as const;
        const error = errors[`interviewAt${n}`];
        return (
          <Field key={n} label={`面談の希望日時（第${n}希望）`} htmlFor={dateKey} error={error}>
            <div className="flex gap-2">
              <Input
                id={dateKey}
                type="date"
                min={dateRange.min}
                max={dateRange.max}
                value={values[dateKey]}
                onChange={(e) => update(dateKey, e.target.value)}
                aria-invalid={!!error}
                className={`${CONTROL} min-w-0 flex-1`}
              />
              <NativeSelect
                aria-label={`第${n}希望の時刻`}
                value={values[timeKey]}
                onChange={(e) => update(timeKey, e.target.value)}
                aria-invalid={!!error}
                className={`${CONTROL} w-28 shrink-0`}
              >
                <option value="">時刻</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}〜
                  </option>
                ))}
              </NativeSelect>
            </div>
          </Field>
        );
      })}

      {/* ボット対策のダミー項目（人間には見えない） */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-base leading-6">
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-brand"
            checked={values.privacyConsent}
            onChange={(e) => update("privacyConsent", e.target.checked)}
            aria-invalid={!!errors.privacyConsent}
          />
          <span>
            <Link href="/privacy" target="_blank" className="underline">
              プライバシーポリシー
            </Link>
            に同意する
          </span>
        </label>
        {errors.privacyConsent && <p className="text-sm text-destructive">{errors.privacyConsent}</p>}
      </div>

      {mutation.isSuccess && (
        <p role="status" className="rounded-xl bg-sky px-4 py-3 text-sm leading-6 font-bold">
          {mutation.data.status === "updated"
            ? "変更を保存しました。"
            : "保存しました。内容を変更する場合は、編集して再度保存してください。"}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          保存に失敗しました。時間をおいて再度お試しください。
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={mutation.isPending}
        className="h-14 rounded-full bg-signal text-lg font-bold text-ink hover:bg-[#ffbf45] focus-visible:ring-brand/40"
      >
        {mutation.isPending ? "保存中..." : isEdit ? "変更を保存する" : "保存する"}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-base font-bold">
        {label}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
