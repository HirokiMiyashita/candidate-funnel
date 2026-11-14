import { api } from "@/lib/orpc/server";
import { LineAutoReplyEditor } from "./line-auto-reply-editor";

export default async function LinePage() {
  const { defs, values, configured } = await api.line.templates();
  return <LineAutoReplyEditor defs={defs} initial={values} configured={configured} />;
}
