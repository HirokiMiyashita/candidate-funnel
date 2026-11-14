import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyEmailLink } from "./actions";

/**
 * 招待メールのリンクの戻り先。
 * リンクを開いただけでは確認せず、ボタンを押したときに確認する
 * （メールのセキュリティ機能がリンクを自動で開いて、1 回限りのリンクを使ってしまうのを防ぐ）。
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = Boolean(tokenHash && type);

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{type === "recovery" ? "パスワードの再設定" : "管理画面への招待"}</CardTitle>
          <CardDescription>
            {valid
              ? "下のボタンを押して、パスワードの設定に進んでください。"
              : "リンクが正しくありません。メールのリンクをもう一度開いてください。"}
          </CardDescription>
        </CardHeader>
        {valid && (
          <form action={verifyEmailLink}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <CardContent />
            <CardFooter>
              <SubmitButton className="w-full" pendingText="確認中...">
                パスワードの設定に進む
              </SubmitButton>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
