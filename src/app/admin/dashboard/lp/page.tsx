import { adminPath } from "@/lib/admin-path";
import { api } from "@/lib/orpc/server";
import { LpContentEditor } from "./lp-content-editor";

export default async function LpContentPage() {
  const content = await api.lpContent.get();
  return <LpContentEditor initial={content} previewUrl={adminPath("/lp-preview")} />;
}
