"use server";

import { ORPCError } from "@orpc/server";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { createClient } from "@/lib/supabase/server";
import { hasNoMembers } from "@/server/admin-auth";
import { inviteAdminMember } from "@/server/orpc/routers/members";

/** オープンリダイレクト対策: 自サイト内の相対パスのみ許可 */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : adminPath("/dashboard");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code !== "invalid_credentials") console.error("login failed:", error.code, error.message);
    const message =
      error.code === "email_not_confirmed"
        ? "招待メールのリンクからパスワードの設定を完了してください。"
        : "メールアドレスまたはパスワードが正しくありません。";
    redirect(
      `${adminPath("/login")}?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(next);
}

/** 最初の 1 人の登録（自分宛てに招待メールを送る） */
export async function setupFirstAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!(await hasNoMembers())) {
    redirect(adminPath("/signup"));
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`${adminPath("/signup")}?error=${encodeURIComponent("メールアドレスの形式が正しくありません")}`);
  }

  try {
    await inviteAdminMember(email, null, "owner");
  } catch (e) {
    const message = e instanceof ORPCError ? e.message : "登録できませんでした。時間をおいて再度お試しください";
    redirect(`${adminPath("/signup")}?error=${encodeURIComponent(message)}`);
  }

  redirect(`${adminPath("/signup/verify")}?email=${encodeURIComponent(email)}`);
}

/** 招待リンクから来た人のパスワード設定 */
export async function setPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (message: string) =>
    redirect(`${adminPath("/set-password")}?error=${encodeURIComponent(message)}`);

  if (password.length < 8) back("パスワードは 8 文字以上で入力してください");
  if (password !== confirm) back("確認用のパスワードが一致しません");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error(error);
    back("パスワードを設定できませんでした。招待リンクをもう一度開いてください");
  }

  redirect(adminPath("/dashboard"));
}
