import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { adminPath } from "@/lib/admin-path";
import { canRemoveMembers, INVITABLE_ROLES, type MemberRole } from "@/lib/member-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/server/admin-auth";
import type { Context } from "../context";
import { authedProcedure } from "../base";

export type AdminMember = {
  userId: string;
  email: string;
  role: MemberRole;
  /** 招待中（まだパスワードを設定していない） */
  pending: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  isMe: boolean;
};

/** メールアドレスでアカウントを探す */
async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(error);
    return null;
  }
  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

/**
 * 招待メールを送り、メンバーとして登録する（最初の 1 人の登録でも使う）。
 * 以前の招待が途中で失敗して「アカウントだけあってメンバーではない」状態なら、作り直して招待し直す。
 */
export async function inviteAdminMember(email: string, invitedBy: string | null, role: MemberRole) {
  const admin = createAdminClient();
  const redirectTo = `${await getSiteOrigin()}${adminPath("/auth/confirm")}`;

  let { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (error && (error.code === "email_exists" || error.status === 422)) {
    const existing = await findAuthUserByEmail(admin, email);
    const { data: member } = existing
      ? await admin.from("admin_members").select("user_id").eq("user_id", existing.id).maybeSingle()
      : { data: null };

    if (existing && !member && !existing.email_confirmed_at) {
      // メンバー登録まで終わらなかった招待中のアカウント → 消して招待し直す
      await admin.auth.admin.deleteUser(existing.id);
      ({ data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo }));
    } else {
      throw new ORPCError("CONFLICT", { message: "このメールアドレスはすでに登録されています" });
    }
  }

  if (error || !data?.user) {
    console.error(error);
    if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message:
          "メールの送信回数の上限に達しました。しばらく待ってから再度お試しください（本番では独自の SMTP の設定をおすすめします）",
      });
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "招待メールを送れませんでした" });
  }

  const { error: insertError } = await admin
    .from("admin_members")
    .insert({ user_id: data.user.id, email, invited_by: invitedBy, role });
  if (insertError) {
    console.error(insertError);
    // メンバー登録に失敗したら、作ったアカウントも消して「アカウントだけ残る」状態を作らない
    await admin.auth.admin.deleteUser(data.user.id);
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "メンバーを登録できませんでした" });
  }
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("メールアドレスの形式が正しくありません"));

/** ログイン中のユーザーの権限 */
async function getMyRole(context: { supabase: Context["supabase"]; user: { id: string } }): Promise<MemberRole | null> {
  const { data, error } = await context.supabase
    .from("admin_members")
    .select("role")
    .eq("user_id", context.user.id)
    .maybeSingle<{ role: MemberRole }>();
  if (error) console.error(error);
  return data?.role ?? null;
}

/** 管理画面向け: メンバーの一覧・招待・削除（メンバーのみ） */
export const membersRouter = {
  list: authedProcedure.handler(async ({ context }): Promise<{ members: AdminMember[]; myRole: MemberRole | null }> => {
    const { data: members, error } = await context.supabase
      .from("admin_members")
      .select("user_id, email, role, created_at")
      .order("created_at")
      .returns<{ user_id: string; email: string; role: MemberRole; created_at: string }[]>();
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR");
    }

    // 招待中かどうか・最終ログインは Auth 側の情報から取る
    const { data: users, error: usersError } = await createAdminClient().auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersError) console.error(usersError);
    const byId = new Map((users?.users ?? []).map((u) => [u.id, u]));

    const myRole = (members ?? []).find((m) => m.user_id === context.user.id)?.role ?? null;
    const list = (members ?? []).map((m) => {
      const u = byId.get(m.user_id);
      return {
        userId: m.user_id,
        email: m.email,
        role: m.role,
        pending: !u?.email_confirmed_at,
        lastSignInAt: u?.last_sign_in_at ?? null,
        createdAt: m.created_at,
        isMe: m.user_id === context.user.id,
      };
    });
    // オーナー → 管理者 → 一般 の順
    const order: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };
    list.sort((a, b) => order[a.role] - order[b.role] || a.createdAt.localeCompare(b.createdAt));
    return { members: list, myRole };
  }),

  invite: authedProcedure
    .input(z.object({ email: emailSchema, role: z.enum(INVITABLE_ROLES) }))
    .handler(async ({ input, context }) => {
      // 一般の人が管理者を招待すると、間接的に削除の権限を得られてしまうため禁止
      if (input.role === "admin" && !canRemoveMembers(await getMyRole(context))) {
        throw new ORPCError("FORBIDDEN", { message: "管理者として招待できるのはオーナーと管理者だけです" });
      }
      await inviteAdminMember(input.email, context.user.id, input.role);
      return { ok: true };
    }),

  /** オーナー権限の譲渡（オーナーのみ。譲渡先は参加済みの管理者。元のオーナーは管理者になる） */
  transferOwnership: authedProcedure
    .input(z.object({ userId: z.uuid() }))
    .handler(async ({ input, context }) => {
      if ((await getMyRole(context)) !== "owner") {
        throw new ORPCError("FORBIDDEN", { message: "オーナー権限を譲渡できるのはオーナーだけです" });
      }
      const { error } = await context.supabase.rpc("transfer_admin_ownership", { new_owner: input.userId });
      if (error) {
        console.error(error);
        if (error.code === "22023") {
          throw new ORPCError("BAD_REQUEST", {
            message: "譲渡できるのは、招待を受けてパスワードを設定済みの管理者だけです",
          });
        }
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "譲渡できませんでした" });
      }
      return { ok: true };
    }),

  /** メンバーの削除（アカウントごと削除。招待の取り消しにも使う） */
  remove: authedProcedure.input(z.object({ userId: z.uuid() })).handler(async ({ input, context }) => {
    if (input.userId === context.user.id) {
      throw new ORPCError("BAD_REQUEST", { message: "自分自身は削除できません" });
    }
    if (!canRemoveMembers(await getMyRole(context))) {
      throw new ORPCError("FORBIDDEN", { message: "メンバーを削除できるのはオーナーと管理者だけです" });
    }
    const { data: target, error: targetError } = await context.supabase
      .from("admin_members")
      .select("role")
      .eq("user_id", input.userId)
      .maybeSingle<{ role: MemberRole }>();
    if (targetError) console.error(targetError);
    if (!target) throw new ORPCError("NOT_FOUND", { message: "メンバーが見つかりません" });
    if (target.role === "owner") {
      throw new ORPCError("FORBIDDEN", { message: "オーナーは削除できません" });
    }
    const { error } = await createAdminClient().auth.admin.deleteUser(input.userId);
    if (error) {
      console.error(error);
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "削除できませんでした" });
    }
    return { ok: true };
  }),
};
