"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

/** 応募一覧の流入元の絞り込み（選ぶとすぐに切り替わる） */
export function SourceFilter({
  options,
  value,
  hrefFor,
}: {
  options: { key: string; label: string; count: number }[];
  value: string | undefined;
  /** 選択値ごとの遷移先（未選択は ""） */
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <NativeSelect
      aria-label="流入元で絞り込み"
      value={value ?? ""}
      onChange={(e) => router.push(hrefFor[e.target.value] ?? hrefFor[""], { scroll: false })}
      className="h-8 w-auto max-w-80 rounded-full text-sm"
    >
      <option value="">流入元: すべて</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}（{o.count}）
        </option>
      ))}
    </NativeSelect>
  );
}
