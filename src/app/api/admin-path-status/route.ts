import { createHash } from "node:crypto";
import { getAdminSegment } from "@/lib/admin-path";

/**
 * 【一時的な診断用】ADMIN_PATH_SEGMENT がサーバーで読めているかを確認する。
 * 値そのものは返さない（照合用にハッシュの先頭 8 文字だけ返す）。原因が分かったら削除すること。
 */
export const dynamic = "force-dynamic";

export function GET() {
  const raw = process.env.ADMIN_PATH_SEGMENT;
  const segment = getAdminSegment();
  return Response.json({
    configured: raw !== undefined && raw !== "",
    valid: segment !== null,
    length: segment?.length ?? raw?.length ?? 0,
    fingerprint: segment ? createHash("sha256").update(segment).digest("hex").slice(0, 8) : null,
    deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
