import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { STATUS_COLORS } from "@/lib/status-colors";
import type { Context } from "../context";
import { authedProcedure } from "../base";

type StatusRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export type ApplicationStatus = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  /** このステータスの応募件数 */
  usage: number;
};

const nameSchema = z
  .string()
  .trim()
  .min(1, "ステータス名を入力してください")
  .max(20, "ステータス名は 20 文字以内で入力してください");

function fail(error: { code?: string; message: string }): never {
  console.error(error);
  if (error.code === "23505") {
    throw new ORPCError("CONFLICT", { message: "同じ名前のステータスがすでにあります" });
  }
  if (error.code === "23503") {
    throw new ORPCError("CONFLICT", {
      message: "このステータスの応募があるため削除できません。先に別のステータスへ変更してください",
    });
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR");
}

/** ステータス一覧（並び順・件数付き） */
export async function listStatuses(supabase: Context["supabase"]): Promise<ApplicationStatus[]> {
  const [statuses, counts] = await Promise.all([
    supabase
      .from("application_statuses")
      .select("id, name, color, sort_order, is_default")
      .order("sort_order")
      .order("created_at"),
    supabase.rpc("application_status_counts"),
  ]);
  if (statuses.error) fail(statuses.error);
  if (counts.error) fail(counts.error);

  const usage = new Map(
    ((counts.data ?? []) as { status_id: string; applications: number }[]).map((c) => [
      c.status_id,
      Number(c.applications),
    ]),
  );

  return ((statuses.data ?? []) as StatusRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isDefault: s.is_default,
    usage: usage.get(s.id) ?? 0,
  }));
}

/** 管理画面向け: 応募ステータスの管理（ログイン必須）。更新系はすべて最新の一覧を返す */
export const statusesRouter = {
  list: authedProcedure.handler(({ context }) => listStatuses(context.supabase)),

  create: authedProcedure
    .input(z.object({ name: nameSchema, color: z.enum(STATUS_COLORS) }))
    .handler(async ({ input, context }) => {
      const current = await listStatuses(context.supabase);
      const { error } = await context.supabase.from("application_statuses").insert({
        name: input.name,
        color: input.color,
        sort_order: current.length + 1,
      });
      if (error) fail(error);
      return listStatuses(context.supabase);
    }),

  update: authedProcedure
    .input(
      z.object({
        id: z.uuid(),
        name: nameSchema.optional(),
        color: z.enum(STATUS_COLORS).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { id, ...fields } = input;
      const { error } = await context.supabase.from("application_statuses").update(fields).eq("id", id);
      if (error) fail(error);
      return listStatuses(context.supabase);
    }),

  reorder: authedProcedure
    .input(z.object({ ids: z.array(z.uuid()).min(1) }))
    .handler(async ({ input, context }) => {
      const { error } = await context.supabase.rpc("reorder_application_statuses", { ids: input.ids });
      if (error) fail(error);
      return listStatuses(context.supabase);
    }),

  setDefault: authedProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ input, context }) => {
      const { error } = await context.supabase.rpc("set_default_application_status", { target: input.id });
      if (error) fail(error);
      return listStatuses(context.supabase);
    }),

  delete: authedProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ input, context }) => {
      const current = await listStatuses(context.supabase);
      const target = current.find((s) => s.id === input.id);
      if (target?.isDefault) {
        throw new ORPCError("CONFLICT", {
          message: "新しい応募の初期ステータスは削除できません。先に別のステータスを初期値にしてください",
        });
      }
      const { error } = await context.supabase.from("application_statuses").delete().eq("id", input.id);
      if (error) fail(error);
      return listStatuses(context.supabase);
    }),
};
