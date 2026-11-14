import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import { ErrorReason } from "./error-reason";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold">認証に失敗しました</h1>
      <ErrorReason reason={reason} />
      <Button asChild>
        <Link href={adminPath("/login")}>ログイン画面へ</Link>
      </Button>
    </div>
  );
}
