-- メンバーの権限（owner = 最初に登録した 1 人 / admin = 管理者 / member = 一般）
-- 違いはメンバー画面で他のメンバーを削除できるかどうか（アプリ側で判定）
alter table public.admin_members
  add column role text not null default 'member' check (role in ('owner', 'admin', 'member'));

-- オーナーは常に 1 人だけ
create unique index admin_members_one_owner on public.admin_members (role) where role = 'owner';

-- 既存のメンバー: 最初に登録した人をオーナー、それ以外は管理者として引き継ぐ
update public.admin_members set role = 'admin';
update public.admin_members
  set role = 'owner'
  where user_id = (select user_id from public.admin_members order by created_at, user_id limit 1);
