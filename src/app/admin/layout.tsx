/**
 * 管理画面（src/app/admin 配下）すべてに適用するレイアウト。
 *
 * 管理画面の URL（ADMIN_PATH_SEGMENT）は環境変数で決まり、リンクやリダイレクトに使うため、
 * ビルド時に静的生成せず、常にアクセスされたときに描画する。
 * （静的生成すると、ビルド時の値で固定される・環境変数が無いとビルドが失敗する）
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
