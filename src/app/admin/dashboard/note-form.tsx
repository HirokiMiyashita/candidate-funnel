"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/lib/orpc/client";

const MAX = 2000;

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "保存できませんでした。もう一度お試しください";
}

/** メモの追加（Ctrl / ⌘ + Enter でも保存） */
export function NoteForm({ candidateId, applicationId }: { candidateId: string; applicationId?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");

  const create = useMutation(
    orpc.notes.create.mutationOptions({
      onSuccess: () => {
        setBody("");
        router.refresh();
      },
    }),
  );

  function submit() {
    if (!body.trim() || body.length > MAX || create.isPending) return;
    create.mutate({ candidateId, applicationId, body });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        aria-label="メモ"
        placeholder="例: 11/16 14時に電話。不在のため 17日 夕方に再度かける"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        className="min-h-20 bg-background"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={!body.trim() || body.length > MAX || create.isPending}>
          {create.isPending ? "保存中..." : "メモを追加"}
        </Button>
        <span className="text-xs text-muted-foreground">⌘ / Ctrl + Enter でも追加できます</span>
        <span className={`ml-auto text-xs tabular-nums ${body.length > MAX ? "text-destructive" : "text-muted-foreground"}`}>
          {body.length}/{MAX}
        </span>
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(create.error)}
        </p>
      )}
    </form>
  );
}

/** 自分のメモの削除 */
export function NoteDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const remove = useMutation(orpc.notes.delete.mutationOptions({ onSuccess: () => router.refresh() }));

  return (
    <button
      type="button"
      disabled={remove.isPending}
      onClick={() => {
        if (window.confirm("このメモを削除しますか？")) remove.mutate({ id });
      }}
      className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
    >
      {remove.isPending ? "削除中..." : "削除"}
    </button>
  );
}
