import { ORPCError, os } from "@orpc/server";
import type { Context } from "./context";

/** 認証不要のプロシージャ */
export const publicProcedure = os.$context<Context>();

/**
 * 管理画面のメンバー専用のプロシージャ（context.user が使える）。
 * ログインしていても、メンバー（admin_members）でなければ拒否する。
 */
export const authedProcedure = publicProcedure.use(async ({ context, next }) => {
  const {
    data: { user },
  } = await context.supabase.auth.getUser();

  if (!user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const { data: isMember, error } = await context.supabase.rpc("is_admin_member");
  if (error) console.error(error);
  if (isMember !== true) {
    throw new ORPCError("FORBIDDEN");
  }

  return next({ context: { user } });
});
