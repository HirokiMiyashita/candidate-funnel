"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc/client";
import { STATUS_COLORS, STATUS_COLOR_CLASS, STATUS_COLOR_LABEL, type StatusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/server/orpc/routers/statuses";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "保存できませんでした。もう一度お試しください";
}

export function StatusManager({ initial }: { initial: ApplicationStatus[] }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // 更新系はすべて最新の一覧を返すので、それで画面を置き換える
  const onSuccess = (next: ApplicationStatus[]) => {
    setStatuses(next);
    setError(null);
    router.refresh();
  };
  const onError = (e: unknown) => setError(errorMessage(e));

  const create = useMutation(orpc.statuses.create.mutationOptions({ onSuccess, onError }));
  const update = useMutation(orpc.statuses.update.mutationOptions({ onSuccess, onError }));
  const reorder = useMutation(orpc.statuses.reorder.mutationOptions({ onSuccess, onError }));
  const setDefault = useMutation(orpc.statuses.setDefault.mutationOptions({ onSuccess, onError }));
  const remove = useMutation(orpc.statuses.delete.mutationOptions({ onSuccess, onError }));

  const busy = create.isPending || update.isPending || reorder.isPending || setDefault.isPending || remove.isPending;

  function move(index: number, to: number) {
    const ids = statuses.map((s) => s.id);
    const [id] = ids.splice(index, 1);
    ids.splice(to, 0, id);
    setStatuses((prev) => ids.map((i) => prev.find((s) => s.id === i)!));
    reorder.mutate({ ids });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y rounded-xl border">
        {statuses.map((s, i) => (
          <StatusRow
            // 名前が保存されたら入力欄を最新の値で作り直す
            key={`${s.id}:${s.name}`}
            status={s}
            isFirst={i === 0}
            isLast={i === statuses.length - 1}
            busy={busy}
            onRename={(name) => update.mutate({ id: s.id, name })}
            onColor={(color) => update.mutate({ id: s.id, color })}
            onUp={() => move(i, i - 1)}
            onDown={() => move(i, i + 1)}
            onSetDefault={() => setDefault.mutate({ id: s.id })}
            onDelete={() => {
              if (window.confirm(`「${s.name}」を削除しますか？`)) remove.mutate({ id: s.id });
            }}
          />
        ))}
      </ul>

      <NewStatusForm busy={busy} onCreate={(name, color) => create.mutate({ name, color })} />
    </div>
  );
}

function StatusRow({
  status,
  isFirst,
  isLast,
  busy,
  onRename,
  onColor,
  onUp,
  onDown,
  onSetDefault,
  onDelete,
}: {
  status: ApplicationStatus;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onRename: (name: string) => void;
  onColor: (color: StatusColor) => void;
  onUp: () => void;
  onDown: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(status.name);
  const deleteBlockedReason = status.isDefault
    ? "初期ステータスは削除できません"
    : status.usage > 0
      ? `${status.usage} 件の応募で使われているため削除できません`
      : null;

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(status.name);
      return;
    }
    if (trimmed !== status.name) onRename(trimmed);
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <ColorPicker value={status.color as StatusColor} onChange={onColor} disabled={busy} />
        <Input
          aria-label="ステータス名"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
            if (e.key === "Escape") setName(status.name);
          }}
          className="max-w-48"
        />
        <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">{status.usage} 件</span>
      </div>

      <div className="flex items-center gap-1.5">
        {status.isDefault ? (
          <span className="rounded-full border px-2.5 py-1 text-xs whitespace-nowrap text-muted-foreground">
            新しい応募の初期値
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onSetDefault}>
            初期値にする
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="上へ" title="上へ" disabled={busy || isFirst} onClick={onUp}>
          ↑
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="下へ" title="下へ" disabled={busy || isLast} onClick={onDown}>
          ↓
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={busy || !!deleteBlockedReason}
          title={deleteBlockedReason ?? "削除"}
          onClick={onDelete}
        >
          削除
        </Button>
      </div>
    </li>
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: StatusColor;
  onChange: (color: StatusColor) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="色" className="flex shrink-0 gap-1">
      {STATUS_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={STATUS_COLOR_LABEL[c]}
          title={STATUS_COLOR_LABEL[c]}
          disabled={disabled}
          onClick={() => value !== c && onChange(c)}
          className={cn(
            "size-5 rounded-full ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            STATUS_COLOR_CLASS[c].dot,
            value === c ? "ring-2 ring-foreground" : "opacity-40 hover:opacity-100",
          )}
        />
      ))}
    </div>
  );
}

function NewStatusForm({ busy, onCreate }: { busy: boolean; onCreate: (name: string, color: StatusColor) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<StatusColor>("blue");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onCreate(name.trim(), color);
        setName("");
      }}
      className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center"
    >
      <ColorPicker value={color} onChange={setColor} disabled={busy} />
      <Input
        aria-label="新しいステータス名"
        placeholder="新しいステータス名（例: 不在・折り返し待ち）"
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" disabled={busy || !name.trim()}>
        追加
      </Button>
    </form>
  );
}
