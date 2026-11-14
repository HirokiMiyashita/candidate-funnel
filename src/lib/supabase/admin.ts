import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * シークレットキーを使うサーバー専用クライアント（RLS をバイパスする）。
 * 未ログインのユーザーに代わってサーバーが処理する場合のみ使い、
 * 必ず呼び出し側で対象データを絞り込むこと。
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY が未設定です");
  }
  return createClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
