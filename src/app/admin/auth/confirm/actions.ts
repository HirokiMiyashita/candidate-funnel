"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/admin-path";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "signup", "magiclink"];

/** 招待メールなどのリンクの確認（ボタンを押したときに実行） */
export async function verifyEmailLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;

  if (tokenHash && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(adminPath(type === "invite" || type === "recovery" ? "/set-password" : "/dashboard"));
    }
    console.error("verifyOtp failed:", error.code, error.message);
    redirect(`${adminPath("/auth/error")}?reason=${encodeURIComponent(error.code ?? "unknown")}`);
  }

  redirect(adminPath("/auth/error"));
}
