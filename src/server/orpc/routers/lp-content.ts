import { ORPCError } from "@orpc/server";
import { DEFAULT_LP_CONTENT, parseLpContent } from "@/lib/lp-content/defaults";
import { lpContentSchema } from "@/lib/lp-content/schema";
import { authedProcedure, publicProcedure } from "../base";

export const lpContentRouter = {
  /** LP 表示用（誰でも取得可） */
  get: publicProcedure.handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("lp_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle<{ content: unknown }>();

    if (error) {
      console.error(error);
      return DEFAULT_LP_CONTENT;
    }
    return parseLpContent(data?.content);
  }),

  /** 管理画面からの更新（ログイン必須） */
  update: authedProcedure.input(lpContentSchema).handler(async ({ input, context }) => {
    const { data, error } = await context.supabase
      .from("lp_settings")
      .upsert({ id: 1, content: input, updated_by: context.user.id })
      .select("updated_at")
      .single<{ updated_at: string }>();

    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    return { updatedAt: data.updated_at };
  }),
};
