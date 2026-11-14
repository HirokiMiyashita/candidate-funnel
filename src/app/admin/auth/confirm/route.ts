import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { adminPath } from "@/lib/admin-path";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "signup", "magiclink"];

/**
 * 招待メールなどのリンクの戻り先。token_hash を検証してログイン状態にし、
 * 招待（パスワード未設定）ならパスワード設定画面へ進める。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const next = type === "invite" || type === "recovery" ? "/set-password" : "/dashboard";
      return NextResponse.redirect(`${origin}${adminPath(next)}`);
    }
    console.error(error);
  }

  return NextResponse.redirect(`${origin}${adminPath("/auth/error")}`);
}
