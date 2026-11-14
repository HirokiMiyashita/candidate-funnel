import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>メールを送信しました</CardTitle>
        <CardDescription>
          {email ? `${email} 宛に` : ""}
          メールを送信しました。メール内のリンクを開いてパスワードを設定してください。
          {process.env.NODE_ENV === "development" && (
            <>
              <br />
              （ローカル環境: http://127.0.0.1:54324 でメールを確認できます）
            </>
          )}
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
