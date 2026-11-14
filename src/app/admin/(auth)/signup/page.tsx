import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { hasNoMembers } from "@/server/admin-auth";
import { setupFirstAdmin } from "../actions";
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

/**
 * 最初の 1 人の登録。メンバーが 1 人でもいれば招待制の案内だけを表示する。
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (!(await hasNoMembers())) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>管理画面は招待制です</CardTitle>
          <CardDescription>
            利用するには、すでに利用している方に招待を依頼してください。招待メールのリンクからパスワードを設定できます。
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" className="w-full" asChild>
            <Link href={adminPath("/login")}>ログイン画面へ</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最初の管理者を登録</CardTitle>
        <CardDescription>
          まだ誰も登録されていないため、最初の 1 人だけここから登録できます。入力したメールアドレスに届くリンクからパスワードを設定してください。2 人目以降は管理画面の「メンバー」から招待します。
        </CardDescription>
      </CardHeader>
      <form action={setupFirstAdmin}>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button type="submit" className="w-full">
            登録メールを送る
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
