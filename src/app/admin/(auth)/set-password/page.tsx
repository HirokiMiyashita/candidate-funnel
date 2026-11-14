import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { getAdminSession } from "@/server/admin-auth";
import { setPassword } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 招待リンクから来た人のパスワード設定 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await getAdminSession();
  if (!user) redirect(adminPath("/login"));
  const { error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワードを設定</CardTitle>
        <CardDescription>{user.email} でログインするためのパスワードを設定してください。</CardDescription>
      </CardHeader>
      <form action={setPassword}>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-2">
            <Label htmlFor="password">パスワード（8 文字以上）</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">パスワード（確認）</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full">
            設定して管理画面へ
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
