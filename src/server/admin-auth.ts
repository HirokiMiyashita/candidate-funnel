import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** ログイン中のユーザーと、管理画面のメンバーかどうか */
export async function getAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isMember: false } as const;

  const { data: isMember, error } = await supabase.rpc("is_admin_member");
  if (error) console.error(error);
  return { user, isMember: isMember === true } as const;
}

/** 招待メールなどのリンクに使うサイトの URL */
export async function getSiteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** メンバーがまだ 1 人もいないか（最初の 1 人だけ自分で登録できる） */
export async function hasNoMembers() {
  const { count, error } = await createAdminClient()
    .from("admin_members")
    .select("user_id", { count: "exact", head: true });
  if (error) {
    console.error(error);
    return false;
  }
  return count === 0;
}
