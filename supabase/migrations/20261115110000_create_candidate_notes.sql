-- 転職希望者についての社内メモ（時系列で追加）。どの応募を見ながら書いたかも残す
create table public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  author_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.candidate_notes is '転職希望者についての社内メモ';

create index candidate_notes_candidate_created_idx on public.candidate_notes (candidate_id, created_at desc);

create trigger candidate_notes_set_updated_at
  before update on public.candidate_notes
  for each row execute function public.set_updated_at();

alter table public.candidate_notes enable row level security;
revoke all on public.candidate_notes from anon;

-- 読む・書くのはメンバー。編集・削除は書いた本人のみ
create policy "admin members can read candidate notes"
  on public.candidate_notes for select to authenticated
  using (public.is_admin_member());
create policy "admin members can add candidate notes"
  on public.candidate_notes for insert to authenticated
  with check (public.is_admin_member() and author_id = auth.uid());
create policy "authors can update own candidate notes"
  on public.candidate_notes for update to authenticated
  using (public.is_admin_member() and author_id = auth.uid())
  with check (public.is_admin_member() and author_id = auth.uid());
create policy "authors can delete own candidate notes"
  on public.candidate_notes for delete to authenticated
  using (public.is_admin_member() and author_id = auth.uid());
