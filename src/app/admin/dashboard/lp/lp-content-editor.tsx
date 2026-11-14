"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { LpSectionKey } from "@/app/(marketing)/landing-view";
import type { LpPreviewMessage } from "@/app/admin/lp-preview/lp-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LP_LIMITS as L, lpContentSchema, type LpContent } from "@/lib/lp-content/schema";
import { orpc } from "@/lib/orpc/client";
import { cn } from "@/lib/utils";

/** 編集欄の並び（LP の上からの順） */
const SECTIONS: { key: LpSectionKey; title: string; description: string }[] = [
  { key: "basic", title: "サービス名・運営会社", description: "ページ左上と一番下に表示されます" },
  { key: "hero", title: "ファーストビュー", description: "最初に表示される見出しと説明" },
  { key: "contact", title: "LINE・電話ボタン", description: "問い合わせ先とボタンの文言" },
  { key: "forYou", title: "こんな方へ", description: "対象となる方の例" },
  { key: "steps", title: "ご相談の流れ", description: "番号付きの手順" },
  { key: "entry", title: "フォーム欄", description: "入力フォームの見出しと説明" },
  { key: "faq", title: "よくある質問", description: "質問と回答" },
];

type Device = "mobile" | "desktop";
const DEVICE_WIDTH: Record<Device, number> = { mobile: 390, desktop: 1280 };

/** 空の行を除いて保存用に整える */
function cleanContent(c: LpContent): LpContent {
  const lines = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  return {
    ...c,
    hero: { ...c.hero, title: lines(c.hero.title), notes: lines(c.hero.notes) },
    forYou: { ...c.forYou, items: lines(c.forYou.items) },
    entry: { ...c.entry, points: lines(c.entry.points) },
  };
}

export function LpContentEditor({ initial, previewUrl }: { initial: LpContent; previewUrl: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Set<LpSectionKey>>(() => new Set(["hero"]));
  const [highlight, setHighlight] = useState<LpSectionKey | null>(null);
  const [device, setDevice] = useState<Device>("mobile");
  const [showPreviewOnMobile, setShowPreviewOnMobile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sectionRefs = useRef<Partial<Record<LpSectionKey, HTMLElement | null>>>({});

  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const mutation = useMutation(
    orpc.lpContent.update.mutationOptions({
      onSuccess: (_, variables) => {
        setSaved(variables);
        setForm(variables);
        router.refresh();
      },
    }),
  );

  // ---- プレビュー（iframe）との連携 ----
  const postToPreview = useCallback((content: LpContent) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "lp-preview:content", content } satisfies LpPreviewMessage,
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    postToPreview(form);
  }, [form, postToPreview]);

  const focusSection = useCallback((key: LpSectionKey) => {
    setOpen((prev) => new Set(prev).add(key));
    setHighlight(key);
    setShowPreviewOnMobile(false);
    requestAnimationFrame(() =>
      sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    window.setTimeout(() => setHighlight((h) => (h === key ? null : h)), 1600);
  }, []);

  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    function onMessage(event: MessageEvent<LpPreviewMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lp-preview:ready") postToPreview(formRef.current);
      if (event.data?.type === "lp-preview:select") focusSection(event.data.section);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [focusSection, postToPreview]);

  // ---- 未保存のまま離れるときの警告 ----
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // ---- 入力の更新 ----
  function patch<S extends keyof LpContent>(section: S, value: Partial<LpContent[S]>) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
  }

  function errorFor(key: string) {
    if (errors[key]) return errors[key];
    const child = Object.keys(errors).find((k) => k.startsWith(`${key}.`));
    return child ? errors[child] : undefined;
  }

  function sectionHasError(key: LpSectionKey) {
    return Object.keys(errors).some((k) => k === key || k.startsWith(`${key}.`));
  }

  function handleSave() {
    mutation.reset();
    const result = lpContentSchema.safeParse(cleanContent(form));
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      const first = SECTIONS.find((s) => Object.keys(next).some((k) => k.startsWith(`${s.key}.`)));
      if (first) focusSection(first.key);
      return;
    }
    setErrors({});
    mutation.mutate(result.data);
  }

  function handleReset() {
    setForm(saved);
    setErrors({});
    mutation.reset();
  }

  function toggle(key: LpSectionKey) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ---- 各セクションの入力欄 ----
  function renderFields(key: LpSectionKey) {
    switch (key) {
      case "basic":
        return (
          <>
            <TextField
              label="サービス名"
              value={form.basic.serviceName}
              max={L.serviceName}
              onChange={(v) => patch("basic", { serviceName: v })}
              error={errorFor("basic.serviceName")}
            />
            <TextField
              label="運営会社名"
              value={form.basic.companyName}
              max={L.companyName}
              onChange={(v) => patch("basic", { companyName: v })}
              error={errorFor("basic.companyName")}
            />
          </>
        );
      case "hero":
        return (
          <>
            <StringListField
              label="見出し"
              hint="1 つの入力欄が 1 行になります"
              items={form.hero.title}
              maxItems={L.heroTitleLines}
              maxLength={L.heroTitleLine}
              itemLabel={(i) => `${i + 1} 行目`}
              addLabel="行を追加"
              onChange={(title) => patch("hero", { title })}
              error={errorFor("hero.title")}
            />
            <TextField
              label="説明文"
              multiline
              value={form.hero.lead}
              max={L.heroLead}
              onChange={(v) => patch("hero", { lead: v })}
              error={errorFor("hero.lead")}
            />
            <StringListField
              label="ボタン下のチェック項目"
              items={form.hero.notes}
              maxItems={L.heroNotes}
              maxLength={L.heroNote}
              addLabel="項目を追加"
              onChange={(notes) => patch("hero", { notes })}
              error={errorFor("hero.notes")}
            />
            <TextField
              label="フォームへのリンク"
              value={form.hero.formLink}
              max={L.formLink}
              onChange={(v) => patch("hero", { formLink: v })}
              error={errorFor("hero.formLink")}
            />
            <TextField
              label="フォームへのリンク（入力済みの方に表示）"
              value={form.hero.formLinkEdit}
              max={L.formLink}
              onChange={(v) => patch("hero", { formLinkEdit: v })}
              error={errorFor("hero.formLinkEdit")}
            />
          </>
        );
      case "contact":
        return (
          <>
            <TextField
              label="LINE の友だち追加 URL"
              value={form.contact.lineUrl}
              onChange={(v) => patch("contact", { lineUrl: v })}
              error={errorFor("contact.lineUrl")}
              inputMode="url"
              action={
                <a
                  href={form.contact.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm underline underline-offset-4"
                >
                  開いて確認
                </a>
              }
            />
            <TextField
              label="LINE ボタンの文言"
              value={form.contact.lineLabel}
              max={L.lineLabel}
              onChange={(v) => patch("contact", { lineLabel: v })}
              error={errorFor("contact.lineLabel")}
            />
            <TextField
              label="電話番号"
              hint="ハイフンありでも、なしでも構いません。スマホではタップで電話がかかります"
              value={form.contact.phoneNumber}
              onChange={(v) => patch("contact", { phoneNumber: v })}
              error={errorFor("contact.phoneNumber")}
              inputMode="tel"
            />
            <TextField
              label="電話ボタンの文言（スマホのみ。PC では番号を表示）"
              value={form.contact.phoneLabel}
              max={L.phoneLabel}
              onChange={(v) => patch("contact", { phoneLabel: v })}
              error={errorFor("contact.phoneLabel")}
            />
            <TextField
              label="受付時間"
              value={form.contact.phoneHours}
              max={L.phoneHours}
              onChange={(v) => patch("contact", { phoneHours: v })}
              error={errorFor("contact.phoneHours")}
            />
          </>
        );
      case "forYou":
        return (
          <>
            <TextField
              label="見出し"
              value={form.forYou.title}
              max={L.sectionTitle}
              onChange={(v) => patch("forYou", { title: v })}
              error={errorFor("forYou.title")}
            />
            <StringListField
              label="項目"
              items={form.forYou.items}
              maxItems={L.forYouItems}
              maxLength={L.forYouItem}
              addLabel="項目を追加"
              onChange={(items) => patch("forYou", { items })}
              error={errorFor("forYou.items")}
            />
          </>
        );
      case "steps":
        return (
          <>
            <TextField
              label="見出し"
              value={form.steps.title}
              max={L.sectionTitle}
              onChange={(v) => patch("steps", { title: v })}
              error={errorFor("steps.title")}
            />
            <CardList
              items={form.steps.items}
              onChange={(items) => patch("steps", { items })}
              newItem={{ title: "", body: "" }}
              addLabel="手順を追加"
              minItems={1}
              maxItems={L.steps}
              itemTitle={(i) => `手順 ${i + 1}`}
              renderItem={(item, i, update) => (
                <>
                  <TextField
                    label="見出し"
                    value={item.title}
                    max={L.stepTitle}
                    onChange={(v) => update({ title: v })}
                    error={errors[`steps.items.${i}.title`]}
                  />
                  <TextField
                    label="説明"
                    multiline
                    value={item.body}
                    max={L.stepBody}
                    onChange={(v) => update({ body: v })}
                    error={errors[`steps.items.${i}.body`]}
                  />
                </>
              )}
            />
          </>
        );
      case "entry":
        return (
          <>
            <TextField
              label="見出し"
              value={form.entry.title}
              max={L.sectionTitle}
              onChange={(v) => patch("entry", { title: v })}
              error={errorFor("entry.title")}
            />
            <TextField
              label="説明"
              multiline
              value={form.entry.body}
              max={L.entryBody}
              onChange={(v) => patch("entry", { body: v })}
              error={errorFor("entry.body")}
            />
            <StringListField
              label="チェック項目（PC のみ表示）"
              items={form.entry.points}
              maxItems={L.entryPoints}
              maxLength={L.entryPoint}
              addLabel="項目を追加"
              onChange={(points) => patch("entry", { points })}
              error={errorFor("entry.points")}
            />
          </>
        );
      case "faq":
        return (
          <>
            <TextField
              label="見出し"
              value={form.faq.title}
              max={L.sectionTitle}
              onChange={(v) => patch("faq", { title: v })}
              error={errorFor("faq.title")}
            />
            <CardList
              items={form.faq.items}
              onChange={(items) => patch("faq", { items })}
              newItem={{ q: "", a: "" }}
              addLabel="質問を追加"
              minItems={0}
              maxItems={L.faqs}
              itemTitle={(i) => `質問 ${i + 1}`}
              renderItem={(item, i, update) => (
                <>
                  <TextField
                    label="質問"
                    value={item.q}
                    max={L.faqQuestion}
                    onChange={(v) => update({ q: v })}
                    error={errors[`faq.items.${i}.q`]}
                  />
                  <TextField
                    label="回答"
                    multiline
                    value={item.a}
                    max={L.faqAnswer}
                    onChange={(v) => update({ a: v })}
                    error={errors[`faq.items.${i}.a`]}
                  />
                </>
              )}
            />
          </>
        );
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="-m-6 flex min-h-[calc(100svh-3.5rem)] flex-col">
      {/* 上部バー */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="mr-auto text-lg font-bold">LP の内容</h1>
        <StatusText
          isDirty={isDirty}
          hasErrors={hasErrors}
          isSuccess={mutation.isSuccess}
          isError={mutation.isError}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setShowPreviewOnMobile((v) => !v)}
        >
          {showPreviewOnMobile ? "編集に戻る" : "プレビュー"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!isDirty || mutation.isPending} onClick={handleReset}>
          元に戻す
        </Button>
        <Button type="button" size="sm" disabled={!isDirty || mutation.isPending} onClick={handleSave}>
          {mutation.isPending ? "保存中..." : "保存して公開"}
        </Button>
      </div>

      <div className="grid flex-1 lg:grid-cols-[minmax(22rem,30rem)_1fr]">
        {/* 編集欄 */}
        <div className={cn("flex flex-col gap-3 p-6", showPreviewOnMobile && "hidden lg:flex")}>
          <p className="text-sm text-muted-foreground">
            右のプレビューで直したい場所をクリックすると、その編集欄が開きます。
          </p>
          {SECTIONS.map((section) => {
            const isOpen = open.has(section.key);
            const panelId = `lp-section-${section.key}`;
            return (
              <section
                key={section.key}
                ref={(el) => {
                  sectionRefs.current[section.key] = el;
                }}
                className={cn(
                  "scroll-mt-20 rounded-xl border bg-card transition-shadow",
                  highlight === section.key && "ring-2 ring-primary/40",
                  sectionHasError(section.key) && "border-destructive/60",
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(section.key)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex-1">
                    <span className="block font-semibold">{section.title}</span>
                    <span className="block text-xs text-muted-foreground">{section.description}</span>
                  </span>
                  {sectionHasError(section.key) && (
                    <span className="text-xs font-medium text-destructive">要確認</span>
                  )}
                  <Chevron open={isOpen} />
                </button>
                {isOpen && (
                  <div id={panelId} className="flex flex-col gap-5 border-t px-4 pt-4 pb-5">
                    {renderFields(section.key)}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* プレビュー */}
        <div
          className={cn(
            "border-l bg-muted/40 lg:block",
            showPreviewOnMobile ? "block" : "hidden",
          )}
        >
          <div className="sticky top-[3.6rem] flex h-[calc(100svh-7.1rem)] flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <div role="group" aria-label="表示する端末" className="inline-flex rounded-lg border bg-background p-0.5">
                {(["mobile", "desktop"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={device === d}
                    onClick={() => setDevice(d)}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm",
                      device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d === "mobile" ? "スマホ" : "PC"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {isDirty ? "保存前の内容を表示中" : "公開中の内容"}
              </span>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-sm underline underline-offset-4"
              >
                公開中の LP を開く
              </a>
            </div>
            <ScaledFrame ref={iframeRef} src={previewUrl} width={DEVICE_WIDTH[device]} device={device} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusText({
  isDirty,
  hasErrors,
  isSuccess,
  isError,
}: {
  isDirty: boolean;
  hasErrors: boolean;
  isSuccess: boolean;
  isError: boolean;
}) {
  if (hasErrors) {
    return (
      <span role="alert" className="text-sm text-destructive">
        入力内容を確認してください
      </span>
    );
  }
  if (isError) {
    return (
      <span role="alert" className="text-sm text-destructive">
        保存できませんでした。もう一度お試しください
      </span>
    );
  }
  if (isDirty) return <span className="text-sm text-amber-600">未保存の変更があります</span>;
  if (isSuccess) {
    return (
      <span role="status" className="text-sm text-muted-foreground">
        保存しました。LP に反映されています
      </span>
    );
  }
  return null;
}

/** 指定した幅で描画した iframe を、表示領域に収まるよう縮小して表示する */
function ScaledFrame({
  ref,
  src,
  width,
  device,
}: {
  ref: React.Ref<HTMLIFrameElement>;
  src: string;
  width: number;
  device: Device;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = size.width ? Math.min(1, size.width / width) : 1;
  const frameHeight = size.height / scale;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      <div
        className={cn(
          "absolute top-0 left-1/2 origin-top overflow-hidden bg-white shadow-sm",
          device === "mobile" ? "rounded-[1.75rem] border-[6px] border-foreground/80" : "rounded-lg border",
        )}
        style={{ width, height: frameHeight, transform: `translateX(-50%) scale(${scale})` }}
      >
        <iframe ref={ref} src={src} title="LP のプレビュー" className="size-full" />
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
    >
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Counter({ value, max }: { value: string; max?: number }) {
  if (!max) return null;
  const over = value.length > max;
  return (
    <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  max,
  error,
  multiline = false,
  inputMode,
  action,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  error?: string;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  action?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Counter value={value} max={max} />
      </div>
      <div className="flex items-center gap-3">
        {multiline ? (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            className="min-h-20"
          />
        ) : (
          <Input
            id={id}
            value={value}
            inputMode={inputMode}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
          />
        )}
        {action}
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** 1 行ずつの入力欄（追加・削除・並べ替え） */
function StringListField({
  label,
  hint,
  items,
  onChange,
  maxItems,
  maxLength,
  itemLabel,
  addLabel,
  error,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  maxItems: number;
  maxLength: number;
  itemLabel?: (index: number) => string;
  addLabel: string;
  error?: string;
}) {
  const groupId = useId();
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndexRef.current !== null) {
      inputsRef.current[focusIndexRef.current]?.focus();
      focusIndexRef.current = null;
    }
  });

  function insertAfter(index: number) {
    if (items.length >= maxItems) return;
    const next = [...items];
    next.splice(index + 1, 0, "");
    focusIndexRef.current = index + 1;
    onChange(next);
  }

  return (
    <div role="group" aria-labelledby={groupId} className="grid gap-1.5">
      <span id={groupId} className="text-sm leading-none font-medium">
        {label}
      </span>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1 flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Input
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                value={item}
                aria-label={itemLabel ? itemLabel(i) : `${label} ${i + 1}`}
                placeholder={itemLabel?.(i)}
                aria-invalid={item.length > maxLength}
                onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    insertAfter(i);
                  }
                }}
                className="pr-14"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                <Counter value={item} max={maxLength} />
              </span>
            </div>
            <IconButton label="上へ" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
              <path d="M10 15V5M5.5 9.5L10 5l4.5 4.5" />
            </IconButton>
            <IconButton
              label="下へ"
              disabled={i === items.length - 1}
              onClick={() => onChange(move(items, i, i + 1))}
            >
              <path d="M10 5v10M5.5 10.5L10 15l4.5-4.5" />
            </IconButton>
            <IconButton label="削除" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <path d="M6 6l8 8M14 6l-8 8" />
            </IconButton>
          </div>
        ))}
      </div>
      {items.length < maxItems && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 justify-self-start"
          onClick={() => insertAfter(items.length - 1)}
        >
          ＋ {addLabel}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** カード形式の一覧（手順・よくある質問） */
function CardList<T extends object>({
  items,
  onChange,
  newItem,
  addLabel,
  minItems,
  maxItems,
  itemTitle,
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: T;
  addLabel: string;
  minItems: number;
  maxItems: number;
  itemTitle: (index: number) => string;
  renderItem: (item: T, index: number, update: (value: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-1.5">
            <span className="mr-auto text-sm font-semibold">{itemTitle(i)}</span>
            <IconButton label="上へ" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}>
              <path d="M10 15V5M5.5 9.5L10 5l4.5 4.5" />
            </IconButton>
            <IconButton
              label="下へ"
              disabled={i === items.length - 1}
              onClick={() => onChange(move(items, i, i + 1))}
            >
              <path d="M10 5v10M5.5 10.5L10 15l4.5-4.5" />
            </IconButton>
            <IconButton
              label="削除"
              disabled={items.length <= minItems}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <path d="M6 6l8 8M14 6l-8 8" />
            </IconButton>
          </div>
          {renderItem(item, i, (value) => onChange(items.map((it, j) => (j === i ? { ...it, ...value } : it))))}
        </div>
      ))}
      {items.length < maxItems && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...items, { ...newItem }])}
        >
          ＋ {addLabel}
        </Button>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="size-8 shrink-0"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-4"
      >
        {children}
      </svg>
    </Button>
  );
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
