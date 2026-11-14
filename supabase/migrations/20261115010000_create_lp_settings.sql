-- LP の文言・問い合わせ先（管理画面から編集）。常に 1 行だけ（id = 1）
create table public.lp_settings (
  id smallint primary key default 1 check (id = 1),
  content jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.lp_settings is 'LP の文言・問い合わせ先。行が無い場合はアプリ側の初期値を使う';

create trigger lp_settings_set_updated_at
  before update on public.lp_settings
  for each row execute function public.set_updated_at();

alter table public.lp_settings enable row level security;

-- LP は公開ページなので誰でも読める
create policy "anyone can read lp settings"
  on public.lp_settings for select
  to anon, authenticated
  using (true);

-- 編集は管理画面（ログイン済み）のみ
create policy "authenticated can insert lp settings"
  on public.lp_settings for insert
  to authenticated
  with check (id = 1);

create policy "authenticated can update lp settings"
  on public.lp_settings for update
  to authenticated
  using (true)
  with check (id = 1);
