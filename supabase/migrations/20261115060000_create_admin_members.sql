-- 管理画面のメンバー（招待制）。ここに登録された人だけが管理画面のデータに触れられる。
-- Supabase Auth のアカウントがあるだけでは何も見えないようにする。
create table public.admin_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.admin_members is '管理画面のメンバー。追加は招待（サーバー側）でのみ行う';

-- 既存の確認済みアカウントはメンバーとして引き継ぐ
insert into public.admin_members (user_id, email)
select id, email from auth.users
where email_confirmed_at is not null and email is not null
on conflict do nothing;

-- ログイン中のユーザーがメンバーかどうか（RLS から使う）
create or replace function public.is_admin_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_members where user_id = auth.uid());
$$;

revoke execute on function public.is_admin_member() from public, anon;
grant execute on function public.is_admin_member() to authenticated;

alter table public.admin_members enable row level security;
revoke all on public.admin_members from anon;

-- 追加・削除はサーバー（シークレットキー）のみ。参照はメンバーのみ
create policy "admin members can read members"
  on public.admin_members for select to authenticated
  using (public.is_admin_member());

-- ---------------------------------------------------------------------------
-- 既存のポリシーを「ログイン済み」から「メンバー」に差し替える
-- ---------------------------------------------------------------------------

-- applicants
drop policy "authenticated can read applicants" on public.applicants;
drop policy "authenticated can update applicants" on public.applicants;
create policy "admin members can read applicants"
  on public.applicants for select to authenticated
  using (public.is_admin_member());
create policy "admin members can update applicants"
  on public.applicants for update to authenticated
  using (public.is_admin_member()) with check (public.is_admin_member());

-- applicant_statuses
drop policy "authenticated can read applicant statuses" on public.applicant_statuses;
drop policy "authenticated can insert applicant statuses" on public.applicant_statuses;
drop policy "authenticated can update applicant statuses" on public.applicant_statuses;
drop policy "authenticated can delete applicant statuses" on public.applicant_statuses;
create policy "admin members can read applicant statuses"
  on public.applicant_statuses for select to authenticated
  using (public.is_admin_member());
create policy "admin members can insert applicant statuses"
  on public.applicant_statuses for insert to authenticated
  with check (public.is_admin_member());
create policy "admin members can update applicant statuses"
  on public.applicant_statuses for update to authenticated
  using (public.is_admin_member()) with check (public.is_admin_member());
create policy "admin members can delete applicant statuses"
  on public.applicant_statuses for delete to authenticated
  using (public.is_admin_member());

-- lp_settings（参照は誰でも可のまま）
drop policy "authenticated can insert lp settings" on public.lp_settings;
drop policy "authenticated can update lp settings" on public.lp_settings;
create policy "admin members can insert lp settings"
  on public.lp_settings for insert to authenticated
  with check (id = 1 and public.is_admin_member());
create policy "admin members can update lp settings"
  on public.lp_settings for update to authenticated
  using (public.is_admin_member()) with check (id = 1 and public.is_admin_member());

-- lp_events
drop policy "authenticated can read lp events" on public.lp_events;
create policy "admin members can read lp events"
  on public.lp_events for select to authenticated
  using (public.is_admin_member());
