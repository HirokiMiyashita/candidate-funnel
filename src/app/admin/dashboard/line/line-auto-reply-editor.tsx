"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc/client";
import { cn } from "@/lib/utils";
import type { TemplateDef, TemplateMap } from "@/server/line/templates";
import type { OutMessage, QuickReplyItem } from "@/server/line/types";

const MAX_MESSAGES = 3;
const MAX_LENGTH = 1000;

const GROUPS: { key: TemplateDef["group"]; title: string; description: string }[] = [
  { key: "phone", title: "電話番号の照合", description: "友だち追加から、電話番号で応募データと照合するまで" },
  { key: "registration", title: "未登録の人の登録", description: "電話番号が見つからなかった人に、LINE で入力してもらう流れ" },
  { key: "linked", title: "連携済みの人", description: "照合・登録が済んだ人からメッセージが届いたとき" },
];

const STATE_LABEL: Record<string, string> = {
  awaiting_phone: "電話番号の待ち",
  choosing_registration: "未登録（入力方法の選択）",
  reg_name: "入力中: 氏名",
  reg_birth_date: "入力中: 生年月日",
  reg_prefecture_region: "入力中: 地方",
  reg_prefecture: "入力中: 都道府県",
  reg_interview_1: "入力中: 第1希望",
  reg_interview_2: "入力中: 第2希望",
  reg_consent: "入力中: 同意",
  reg_confirm: "入力中: 確認",
  linked: "連携済み",
  locked: "試行回数の上限",
};

function validate(defs: TemplateDef[], values: TemplateMap) {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    const messages = values[def.key] ?? [];
    if (messages.some((m) => !m.trim())) errors[def.key] = "空のメッセージがあります";
    else if (messages.some((m) => m.length > MAX_LENGTH)) errors[def.key] = `1 通 ${MAX_LENGTH} 文字以内にしてください`;
    else if (messages.length === 0 && !def.allowEmpty) errors[def.key] = "メッセージを 1 つ以上入力してください";
  }
  return errors;
}

export function LineAutoReplyEditor({
  defs,
  initial,
  configured,
}: {
  defs: TemplateDef[];
  initial: TemplateMap;
  configured: { channel: boolean; webhookUrl: string };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);

  const isDirty = JSON.stringify(values) !== JSON.stringify(saved);
  const errors = validate(defs, values);
  const hasErrors = Object.keys(errors).length > 0;

  const save = useMutation(
    orpc.line.saveTemplates.mutationOptions({
      onSuccess: () => {
        setSaved(values);
        router.refresh();
      },
    }),
  );

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function handleSave() {
    save.reset();
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    // 変更のあった場面だけ保存する
    const changed = Object.fromEntries(
      defs
        .filter((d) => JSON.stringify(values[d.key]) !== JSON.stringify(saved[d.key]))
        .map((d) => [d.key, values[d.key].map((m) => m.trim())]),
    );
    save.mutate(changed);
  }

  // シミュレーターには、エラーの無い場面の編集中の文面を渡す
  const draftForSimulator = Object.fromEntries(
    defs.filter((d) => !errors[d.key]).map((d) => [d.key, values[d.key].map((m) => m.trim())]),
  );

  return (
    <div className="-m-6 flex min-h-[calc(100svh-3.5rem)] flex-col">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="mr-auto text-lg font-bold">LINE の自動返信</h1>
        {showErrors && hasErrors ? (
          <span role="alert" className="text-sm text-destructive">
            入力内容を確認してください
          </span>
        ) : save.isError ? (
          <span role="alert" className="text-sm text-destructive">
            保存できませんでした
          </span>
        ) : isDirty ? (
          <span className="text-sm text-amber-600">未保存の変更があります</span>
        ) : save.isSuccess ? (
          <span role="status" className="text-sm text-muted-foreground">
            保存しました。LINE の返信に反映されています
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty || save.isPending}
          onClick={() => {
            setValues(saved);
            setShowErrors(false);
          }}
        >
          元に戻す
        </Button>
        <Button type="button" size="sm" disabled={!isDirty || save.isPending} onClick={handleSave}>
          {save.isPending ? "保存中..." : "保存"}
        </Button>
      </div>

      <div className="grid flex-1 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-8 p-6">
          <SetupNotice configured={configured} />

          {GROUPS.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold">{group.title}</h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
              {defs
                .filter((d) => d.group === group.key)
                .map((def) => (
                  <TemplateCard
                    key={def.key}
                    def={def}
                    messages={values[def.key] ?? []}
                    error={showErrors ? errors[def.key] : undefined}
                    dirty={JSON.stringify(values[def.key]) !== JSON.stringify(saved[def.key])}
                    onChange={(messages) => setValues((prev) => ({ ...prev, [def.key]: messages }))}
                  />
                ))}
            </section>
          ))}
        </div>

        <div className="border-l bg-muted/40">
          <div className="sticky top-[3.6rem] h-[calc(100svh-7.1rem)] p-4">
            <Simulator templates={draftForSimulator} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupNotice({ configured }: { configured: { channel: boolean; webhookUrl: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-xl border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">LINE との接続</span>
        {configured.channel ? (
          <span className="rounded-full bg-[#06c755]/10 px-2 py-0.5 text-xs font-medium text-[#05873a]">設定済み</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">未設定</span>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">
        LINE Developers の Messaging API 設定で、Webhook URL に次の URL を登録し「Webhook の利用」をオンにしてください。
        {!configured.channel && " サーバーの環境変数 LINE_CHANNEL_SECRET と LINE_CHANNEL_ACCESS_TOKEN の設定も必要です。"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{configured.webhookUrl}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(configured.webhookUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "コピーしました" : "コピー"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        LINE Official Account Manager の応答設定で「あいさつメッセージ」と「応答メッセージ」はオフにしてください（ここで設定した文面と二重に送られるため）。
      </p>
    </section>
  );
}

function TemplateCard({
  def,
  messages,
  error,
  dirty,
  onChange,
}: {
  def: TemplateDef;
  messages: string[];
  error?: string;
  dirty: boolean;
  onChange: (messages: string[]) => void;
}) {
  const baseId = useId();
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", error && "border-destructive/60")}>
      <div>
        <p className="flex items-center gap-2 font-medium">
          {def.label}
          {dirty && <span className="size-1.5 rounded-full bg-amber-500" title="未保存の変更" />}
        </p>
        <p className="text-xs text-muted-foreground">{def.description}</p>
      </div>

      {messages.length === 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">自動では返信しません。</p>
      )}

      {messages.map((message, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor={`${baseId}-${i}`} className="text-xs text-muted-foreground">
              {i + 1} 通目
            </label>
            <span className="flex items-center gap-2">
              <span className={cn("text-xs tabular-nums", message.length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground")}>
                {message.length}/{MAX_LENGTH}
              </span>
              {(messages.length > 1 || def.allowEmpty) && (
                <button
                  type="button"
                  onClick={() => onChange(messages.filter((_, j) => j !== i))}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  削除
                </button>
              )}
            </span>
          </div>
          <Textarea
            id={`${baseId}-${i}`}
            value={message}
            onChange={(e) => onChange(messages.map((m, j) => (j === i ? e.target.value : m)))}
            aria-invalid={!!error}
            className="min-h-16"
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        {messages.length < MAX_MESSAGES && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...messages, ""])}>
            ＋ メッセージを追加
          </Button>
        )}
        {def.variables && def.variables.length > 0 && (
          <span className="text-xs text-muted-foreground">
            差し込み:{" "}
            {def.variables.map((v) => (
              <span key={v.name} title={v.description} className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-mono">
                {`{{${v.name}}}`}
              </span>
            ))}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// シミュレーター
// ---------------------------------------------------------------------------

type ChatItem = { from: "user" | "bot"; text: string; quickReply?: QuickReplyItem[] };

function Simulator({ templates }: { templates: TemplateMap }) {
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [state, setState] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const simulate = useMutation(
    orpc.line.simulate.mutationOptions({
      onSuccess: (res) => {
        setState(res.state);
        setChat((prev) => [
          ...prev,
          ...res.replies.map((m: OutMessage) => ({ from: "bot" as const, text: m.text, quickReply: m.quickReply })),
          ...(res.replies.length === 0 ? [{ from: "bot" as const, text: "（返信なし）" }] : []),
        ]);
      },
    }),
  );
  const reset = useMutation(
    orpc.line.resetSimulator.mutationOptions({
      onSuccess: () => {
        setChat([]);
        setState(null);
      },
    }),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat]);

  function send(userText: string | null, input: Parameters<typeof simulate.mutate>[0]["input"]) {
    if (userText !== null) setChat((prev) => [...prev, { from: "user", text: userText }]);
    simulate.mutate({ input, templates });
  }

  const last = chat.at(-1);
  const quickReply = last?.from === "bot" ? last.quickReply : undefined;
  const busy = simulate.isPending || reset.isPending;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">シミュレーター</p>
          <p className="truncate text-xs text-muted-foreground">
            状態: {state ? (STATE_LABEL[state] ?? state) : "未開始"}（登録・連携はされません）
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => reset.mutate({})}>
          リセット
        </Button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[#8cabd9]/25 px-3 py-4">
        {chat.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <p>
              LINE と同じ流れを試せます。
              <br />
              電話番号の照合は実際のデータで確認します。
            </p>
            <Button type="button" size="sm" disabled={busy} onClick={() => send(null, { kind: "follow" })}>
              友だち追加する
            </Button>
          </div>
        )}
        {chat.map((item, i) => (
          <p
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
              item.from === "user" ? "self-end rounded-br-md bg-[#06c755] text-white" : "self-start rounded-bl-md bg-white shadow-sm",
            )}
          >
            {item.text}
          </p>
        ))}
        {simulate.isPending && <p className="self-start text-xs text-muted-foreground">送信中...</p>}
        {simulate.isError && (
          <p role="alert" className="self-start text-xs text-destructive">
            エラーになりました。リセットして試してください。
          </p>
        )}
      </div>

      {quickReply && quickReply.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t bg-background px-3 py-2">
          {quickReply.map((item, i) => (
            <QuickReplyButton key={i} item={item} disabled={busy} onSend={send} />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          send(text, { kind: "text", text });
          setText("");
        }}
        className="flex gap-2 border-t px-3 py-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="メッセージを入力"
          aria-label="シミュレーターに送るメッセージ"
          disabled={chat.length === 0}
        />
        <Button type="submit" size="sm" disabled={busy || !text.trim() || chat.length === 0}>
          送信
        </Button>
      </form>
    </div>
  );
}

function QuickReplyButton({
  item,
  disabled,
  onSend,
}: {
  item: QuickReplyItem;
  disabled: boolean;
  onSend: (
    userText: string | null,
    input: { kind: "postback"; data: string; params?: { date?: string; datetime?: string } },
  ) => void;
}) {
  const [value, setValue] = useState("");

  if (item.type === "uri") {
    return (
      <a href={item.uri} target="_blank" rel="noopener noreferrer" className="rounded-full border px-3 py-1 text-xs">
        {item.label}
      </a>
    );
  }

  if (item.type === "datetimepicker") {
    const isDate = item.mode === "date";
    return (
      <span className="flex items-center gap-1 rounded-full border px-2 py-0.5">
        <input
          type={isDate ? "date" : "datetime-local"}
          aria-label={item.label}
          value={value}
          min={item.min}
          max={item.max}
          step={isDate ? undefined : 60}
          onChange={(e) => setValue(e.target.value)}
          className="bg-transparent text-xs outline-none"
        />
        <button
          type="button"
          disabled={disabled || !value}
          onClick={() =>
            onSend(value.replace("T", " "), {
              kind: "postback",
              data: item.data,
              params: isDate ? { date: value } : { datetime: value },
            })
          }
          className="text-xs font-medium text-[#05873a] disabled:opacity-40"
        >
          {item.label}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSend(item.displayText, { kind: "postback", data: item.data })}
      className="rounded-full border border-[#06c755] px-3 py-1 text-xs font-medium text-[#05873a] hover:bg-[#06c755]/10 disabled:opacity-40"
    >
      {item.label}
    </button>
  );
}
