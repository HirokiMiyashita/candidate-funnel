"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatJstDateTime } from "@/lib/entry/datetime";
import { canRemoveMembers, ROLE_LABEL, type InvitableRole, type MemberRole } from "@/lib/member-roles";
import { orpc } from "@/lib/orpc/client";
import { cn } from "@/lib/utils";
import type { AdminMember } from "@/server/orpc/routers/members";

const ROLE_BADGE: Record<MemberRole, string> = {
  owner: "border-violet-200 bg-violet-50 text-violet-700",
  admin: "border-blue-200 bg-blue-50 text-blue-700",
  member: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "処理できませんでした。もう一度お試しください";
}

export function MemberManager({ initial, myRole }: { initial: AdminMember[]; myRole: MemberRole | null }) {
  const router = useRouter();
  const canManage = canRemoveMembers(myRole);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const invite = useMutation(
    orpc.members.invite.mutationOptions({
      onSuccess: (_, variables) => {
        setNotice({
          type: "ok",
          text: `${variables.email} に${ROLE_LABEL[variables.role]}として招待メールを送りました`,
        });
        setEmail("");
        router.refresh();
      },
      onError: (e) => setNotice({ type: "error", text: errorMessage(e) }),
    }),
  );

  const transfer = useMutation(
    orpc.members.transferOwnership.mutationOptions({
      onSuccess: () => {
        setNotice({ type: "ok", text: "オーナー権限を譲渡しました。あなたは管理者になりました" });
        router.refresh();
      },
      onError: (e) => setNotice({ type: "error", text: errorMessage(e) }),
    }),
  );

  const remove = useMutation(
    orpc.members.remove.mutationOptions({
      onSuccess: () => {
        setNotice({ type: "ok", text: "削除しました" });
        router.refresh();
      },
      onError: (e) => setNotice({ type: "error", text: errorMessage(e) }),
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          setNotice(null);
          invite.mutate({ email: email.trim(), role: canManage ? role : "member" });
        }}
        className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row"
      >
        <Input
          type="email"
          aria-label="招待するメールアドレス"
          placeholder="招待するメールアドレス"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <NativeSelect
          aria-label="権限"
          value={canManage ? role : "member"}
          disabled={!canManage}
          onChange={(e) => setRole(e.target.value as InvitableRole)}
          className="sm:w-28"
        >
          <option value="member">{ROLE_LABEL.member}</option>
          {canManage && <option value="admin">{ROLE_LABEL.admin}</option>}
        </NativeSelect>
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          {invite.isPending ? "送信中..." : "招待メールを送る"}
        </Button>
      </form>

      {notice && (
        <p
          role={notice.type === "error" ? "alert" : "status"}
          className={
            notice.type === "error"
              ? "rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              : "rounded-lg bg-muted px-4 py-3 text-sm"
          }
        >
          {notice.text}
        </p>
      )}

      <ul className="flex flex-col divide-y rounded-xl border">
        {initial.map((m) => {
          const removable = canManage && !m.isMe && m.role !== "owner";
          const transferable = myRole === "owner" && m.role === "admin" && !m.pending;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {m.email}
                  {m.isMe && <span className="text-xs font-normal text-muted-foreground">（あなた）</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.pending
                    ? `招待中（${formatJstDateTime(m.createdAt)} に招待）`
                    : m.lastSignInAt
                      ? `最終ログイン ${formatJstDateTime(m.lastSignInAt)}`
                      : "ログイン履歴なし"}
                </p>
              </div>
              {m.pending && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
                  招待中
                </span>
              )}
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", ROLE_BADGE[m.role])}>
                {ROLE_LABEL[m.role]}
              </span>
              {transferable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={transfer.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `${m.email} にオーナー権限を譲渡しますか？\nあなたは管理者になり、元に戻すには新しいオーナーに譲渡し直してもらう必要があります。`,
                      )
                    ) {
                      transfer.mutate({ userId: m.userId });
                    }
                  }}
                >
                  オーナーを譲渡
                </Button>
              )}
              {removable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    const label = m.pending
                      ? `${m.email} への招待を取り消しますか？`
                      : `${m.email} を削除しますか？管理画面に入れなくなります。`;
                    if (window.confirm(label)) remove.mutate({ userId: m.userId });
                  }}
                >
                  {m.pending ? "招待を取り消す" : "削除"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
