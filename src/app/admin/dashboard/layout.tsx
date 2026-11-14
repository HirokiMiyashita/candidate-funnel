import Link from "next/link";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { getAdminSession } from "@/server/admin-auth";
import { Button } from "@/components/ui/button";
import { signOut } from "./actions";

// TODO: サイドバー等のナビゲーションを本実装（仮の骨組み）
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, isMember } = await getAdminSession();

  // proxy.ts でも保護しているが、念のためサーバー側でも確認する
  if (!user) redirect(adminPath("/login"));

  // ログインできてもメンバー（招待された人）でなければ何も見せない
  if (!isMember) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">このアカウントには管理画面の権限がありません</h1>
        <p className="text-sm text-muted-foreground">利用している方に招待を依頼してください。</p>
        <form action={signOut}>
          <Button variant="outline" type="submit">
            ログアウト
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar p-4 md:block">
        <Link href={adminPath("/dashboard")} className="mb-6 block font-semibold">
          candidate-funnel
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href={adminPath("/dashboard")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            応募一覧
          </Link>
          <Link href={adminPath("/dashboard/candidates")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            登録者一覧
          </Link>
          <Link href={adminPath("/dashboard/analytics")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            流入分析
          </Link>
          <Link href={adminPath("/dashboard/lp")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            LP の内容
          </Link>
          <Link href={adminPath("/dashboard/line")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            LINE の自動返信
          </Link>
          <Link href={adminPath("/dashboard/statuses")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            ステータスの編集
          </Link>
          <Link href={adminPath("/dashboard/members")} className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            メンバー
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              ログアウト
            </Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
