"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/client";
import { statusColorClass } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; color: string };

/** 応募一覧の表の中でステータスを直接変更する */
export function StatusSelect({
  applicationId,
  personName,
  statusId,
  options,
}: {
  applicationId: string;
  personName: string;
  statusId: string;
  options: Option[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(statusId);

  const mutation = useMutation(
    orpc.applications.updateStatus.mutationOptions({
      // 絞り込みの件数を更新する
      onSuccess: () => router.refresh(),
      // 失敗したら元に戻す
      onError: () => setValue(statusId),
    }),
  );

  const current = options.find((o) => o.id === value);
  const color = statusColorClass(current?.color ?? "gray");

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`${personName} さんのステータス`}
        value={value}
        disabled={mutation.isPending}
        onChange={(e) => {
          setValue(e.target.value);
          mutation.mutate({ id: applicationId, statusId: e.target.value });
        }}
        className={cn(
          "h-8 cursor-pointer rounded-full border px-3 pr-7 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60",
          color.badge,
        )}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {mutation.isError && (
        <span role="alert" className="text-xs whitespace-nowrap text-destructive">
          変更できませんでした
        </span>
      )}
    </div>
  );
}
