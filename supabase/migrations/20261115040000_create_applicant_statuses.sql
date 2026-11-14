-- 応募の対応状況（ステータス）。種類は管理画面から追加・変更できる
create table public.applicant_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  color text not null default 'gray' check (color in ('gray', 'blue', 'green', 'amber', 'red', 'purple')),
  sort_order integer not null default 0,
  -- 新しい応募に自動で付くステータス（常に 1 つだけ）
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.applicant_statuses is '応募の対応状況（電話済み・日程再調整など）。管理画面で編集';

create unique index applicant_statuses_name_key on public.applicant_statuses (name);
create unique index applicant_statuses_one_default on public.applicant_statuses (is_default) where is_default;

insert into public.applicant_statuses (name, color, sort_order, is_default) values
  ('未対応', 'red', 1, true),
  ('電話済み', 'blue', 2, false),
  ('日程再調整', 'amber', 3, false),
  ('面談確定', 'green', 4, false),
  ('対応終了', 'gray', 5, false);

-- applicants.status（文字列）を applicant_statuses への参照に置き換える
alter table public.applicants
  add column status_id uuid references public.applicant_statuses (id) on delete restrict,
  add column status_updated_at timestamptz,
  add column status_updated_by uuid references auth.users (id) on delete set null;

update public.applicants
  set status_id = (select id from public.applicant_statuses where is_default);

alter table public.applicants alter column status_id set not null;
alter table public.applicants drop column status;

create index applicants_status_id_idx on public.applicants (status_id);

-- 新しい応募にはその時点の初期ステータスを付ける
create or replace function public.applicants_set_default_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status_id is null then
    select id into new.status_id from public.applicant_statuses where is_default limit 1;
  end if;
  return new;
end;
$$;

create trigger applicants_default_status
  before insert on public.applicants
  for each row execute function public.applicants_set_default_status();

-- RLS: 管理画面（ログイン済み）のみ
alter table public.applicant_statuses enable row level security;
revoke all on public.applicant_statuses from anon;

create policy "authenticated can read applicant statuses"
  on public.applicant_statuses for select to authenticated using (true);
create policy "authenticated can insert applicant statuses"
  on public.applicant_statuses for insert to authenticated with check (true);
create policy "authenticated can update applicant statuses"
  on public.applicant_statuses for update to authenticated using (true) with check (true);
create policy "authenticated can delete applicant statuses"
  on public.applicant_statuses for delete to authenticated using (true);

-- 初期ステータスの切り替え（1 つだけになるようまとめて更新）
create or replace function public.set_default_applicant_status(target uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.applicant_statuses where id = target) then
    raise exception 'status not found';
  end if;
  update public.applicant_statuses set is_default = false where is_default and id <> target;
  update public.applicant_statuses set is_default = true where id = target;
end;
$$;

-- 並び順の一括更新（ids の順に 1, 2, 3...）
create or replace function public.reorder_applicant_statuses(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.applicant_statuses s
  set sort_order = t.ord
  from unnest(ids) with ordinality as t(id, ord)
  where s.id = t.id;
$$;

-- ステータスごとの応募件数
create or replace function public.applicant_status_counts()
returns table (status_id uuid, applicants bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.status_id, count(*) from public.applicants a group by a.status_id;
$$;

revoke execute on function public.set_default_applicant_status(uuid) from public, anon;
revoke execute on function public.reorder_applicant_statuses(uuid[]) from public, anon;
revoke execute on function public.applicant_status_counts() from public, anon;
grant execute on function public.set_default_applicant_status(uuid) to authenticated;
grant execute on function public.reorder_applicant_statuses(uuid[]) to authenticated;
grant execute on function public.applicant_status_counts() to authenticated;
