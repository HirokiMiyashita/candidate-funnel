/** 管理画面メンバーの権限（ブラウザ・サーバー共用） */
export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** 招待で選べる権限（オーナーは最初に登録した 1 人だけ） */
export const INVITABLE_ROLES = ["admin", "member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "一般",
};

/** 他のメンバーを削除できるか（＝管理者として招待できるか） */
export function canRemoveMembers(role: MemberRole | null) {
  return role === "owner" || role === "admin";
}
