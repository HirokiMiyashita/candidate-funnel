import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authedProcedure } from "../base";

export const NOTE_MAX_LENGTH = 2000;

/** 管理画面向け: 転職希望者のメモ（メンバーのみ。削除は書いた本人のみ） */
export const notesRouter = {
  create: authedProcedure
    .input(
      z.object({
        candidateId: z.uuid(),
        applicationId: z.uuid().optional(),
        body: z
          .string()
          .trim()
          .min(1, "メモを入力してください")
          .max(NOTE_MAX_LENGTH, `メモは ${NOTE_MAX_LENGTH} 文字以内で入力してください`),
      }),
    )
    .handler(async ({ input, context }) => {
      const { error } = await context.supabase.from("candidate_notes").insert({
        candidate_id: input.candidateId,
        application_id: input.applicationId ?? null,
        body: input.body,
        author_id: context.user.id,
      });
      if (error) {
        console.error(error);
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "メモを保存できませんでした" });
      }
      return { ok: true };
    }),

  delete: authedProcedure.input(z.object({ id: z.uuid() })).handler(async ({ input, context }) => {
    const { data, error } = await context.supabase
      .from("candidate_notes")
      .delete()
      .eq("id", input.id)
      .select("id");
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "削除できませんでした" });
    }
    if (!data || data.length === 0) {
      throw new ORPCError("FORBIDDEN", { message: "削除できるのは自分が書いたメモだけです" });
    }
    return { ok: true };
  }),
};
