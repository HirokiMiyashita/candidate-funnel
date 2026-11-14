import { api } from "@/lib/orpc/server";
import { MemberManager } from "./member-manager";

export default async function MembersPage() {
  const { members, myRole } = await api.members.list();

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">メンバー</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理画面を使える人です。招待するとメールが届き、本人がリンクからパスワードを設定すると使えるようになります。
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          オーナーと管理者は他のメンバーを削除できます（オーナーは削除できません）。一般の方は削除できず、招待も「一般」のみです。オーナーは参加済みの管理者にオーナー権限を譲渡できます。
        </p>
      </div>
      <MemberManager initial={members} myRole={myRole} />
    </div>
  );
}
