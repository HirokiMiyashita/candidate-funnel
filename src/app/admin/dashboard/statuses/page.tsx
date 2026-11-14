import { api } from "@/lib/orpc/server";
import { StatusManager } from "./status-manager";

export default async function StatusesPage() {
  const statuses = await api.statuses.list();

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">ステータスの編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          応募一覧で使うステータスです。名前や色を変えると、すでに付いている応募の表示も変わります。
        </p>
      </div>
      <StatusManager initial={statuses} />
    </div>
  );
}
