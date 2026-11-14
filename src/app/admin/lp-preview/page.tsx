import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { LP_ROOT_CLASS } from "@/lib/fonts";
import { api } from "@/lib/orpc/server";
import { getAdminSession } from "@/server/admin-auth";
import { LpPreview } from "./lp-preview";

/**
 * 管理画面の「LP の内容」で iframe に表示するプレビュー。
 * 親画面から編集中の内容を postMessage で受け取って表示する（保存前の内容）。
 */
export default async function LpPreviewPage() {
  const { user, isMember } = await getAdminSession();
  if (!user || !isMember) redirect(adminPath("/login"));

  const content = await api.lpContent.get();

  return (
    <div className={`${LP_ROOT_CLASS} min-h-svh`}>
      <LpPreview initial={content} />
    </div>
  );
}
