/**
 * 管理画面の URL パス管理。
 *
 * 管理画面は内部的には src/app/admin/** に置いているが、
 * 外部からは /<ADMIN_PATH_SEGMENT>/** でしかアクセスできない（proxy.ts で書き換え）。
 * /admin への直接アクセスは 404 を返す。
 *
 * ADMIN_PATH_SEGMENT は環境変数で設定し、リポジトリには含めない。
 * 例: admin-3f9c1a7e5b2d8046a1c9e7f2
 *
 * サーバー側（Server Component / Server Action / Route Handler / proxy）専用。
 * Client Component では使わないこと（値がブラウザに埋め込まれるため）。
 */

/** 内部のルートパス（src/app/admin） */
export const INTERNAL_ADMIN_PREFIX = "/admin";

/** 推測されにくさを担保するための最低文字数 */
const MIN_SEGMENT_LENGTH = 16;

export function getAdminSegment(): string | null {
  const segment = process.env.ADMIN_PATH_SEGMENT;
  if (!segment || segment.length < MIN_SEGMENT_LENGTH || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    return null;
  }
  return segment;
}

/** 管理画面の公開 URL パスを返す。例: adminPath("/login") → "/admin-xxxx/login" */
export function adminPath(path: `/${string}` = "/"): string {
  const segment = getAdminSegment();
  if (!segment) {
    throw new Error(
      `ADMIN_PATH_SEGMENT が未設定か不正です（英数字・-・_ で ${MIN_SEGMENT_LENGTH} 文字以上）`,
    );
  }
  return path === "/" ? `/${segment}` : `/${segment}${path}`;
}
