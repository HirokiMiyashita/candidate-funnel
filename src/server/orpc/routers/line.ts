import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { getSiteOrigin } from "@/server/admin-auth";
import { handleLineInput } from "@/server/line/flow";
import { createLineStore, loadTemplateRows } from "@/server/line/store";
import { LINE_TEMPLATE_DEFS, resolveTemplates, templateMapSchema } from "@/server/line/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { authedProcedure } from "../base";

const flowInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("follow") }),
  z.object({ kind: z.literal("unfollow") }),
  z.object({ kind: z.literal("text"), text: z.string().max(1000) }),
  z.object({
    kind: z.literal("postback"),
    data: z.string().max(300),
    params: z.object({ date: z.string().max(20).optional(), datetime: z.string().max(20).optional() }).optional(),
  }),
]);

/** シミュレーターの会話はメンバーごとに分ける（本物の LINE ユーザー ID とは重ならない形式） */
const simulatorUserId = (userId: string) => `simulator:${userId}`;

/** 管理画面向け: LINE の自動返信の文面とシミュレーター（メンバーのみ） */
export const lineRouter = {
  templates: authedProcedure.handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("line_message_templates").select("key, messages");
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    return {
      defs: LINE_TEMPLATE_DEFS,
      values: resolveTemplates((data ?? []) as { key: string; messages: unknown }[]),
      configured: {
        channel: Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
        webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? (await getSiteOrigin())}/api/line/webhook`,
      },
    };
  }),

  saveTemplates: authedProcedure.input(templateMapSchema).handler(async ({ input, context }) => {
    const rows = Object.entries(input).map(([key, messages]) => ({
      key,
      messages,
      updated_by: context.user.id,
    }));
    if (rows.length === 0) return { ok: true };
    const { error } = await context.supabase.from("line_message_templates").upsert(rows);
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "保存できませんでした" });
    }
    return { ok: true };
  }),

  /**
   * シミュレーター: 本番と同じ会話の処理を動かして、返信を返す。
   * 会話の状態は保存するが、人との連携・登録は行わない。templates を渡すと保存前の文面で試せる。
   */
  simulate: authedProcedure
    .input(z.object({ input: flowInputSchema, templates: templateMapSchema.optional() }))
    .handler(async ({ input, context }) => {
      const lineUserId = simulatorUserId(context.user.id);
      const templates = resolveTemplates([
        ...(await loadTemplateRows()),
        ...Object.entries(input.templates ?? {}).map(([key, messages]) => ({ key, messages })),
      ]);
      const replies = await handleLineInput(
        {
          store: createLineStore(lineUserId, { simulator: true }),
          templates,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? (await getSiteOrigin()),
          lineUserId,
        },
        input.input,
      );
      const { data } = await createAdminClient()
        .from("line_users")
        .select("state")
        .eq("line_user_id", lineUserId)
        .maybeSingle<{ state: string }>();
      return { replies, state: data?.state ?? null };
    }),

  /** シミュレーターの会話をリセット */
  resetSimulator: authedProcedure.handler(async ({ context }) => {
    const { error } = await createAdminClient()
      .from("line_users")
      .delete()
      .eq("line_user_id", simulatorUserId(context.user.id))
      .eq("is_simulator", true);
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }
    return { ok: true };
  }),
};
