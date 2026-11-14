-- LP から送信される転職希望者の応募データ
create table public.applicants (
  id uuid primary key default gen_random_uuid(),

  -- 入力項目
  full_name text not null check (char_length(full_name) between 1 and 100),
  birth_date date not null,
  phone text not null check (phone ~ '^0[0-9]{9,10}$'),               -- ハイフンなしに正規化して保存
  prefecture_code smallint not null check (prefecture_code between 1 and 47), -- JIS X 0401
  interview_at_1 timestamptz not null,
  interview_at_2 timestamptz not null,
  privacy_consented_at timestamptz not null,

  -- 社内管理用
  status text not null default 'new',

  -- 流入元（初回送信時のみ記録し、再送信では上書きしない）
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  referrer text,
  landing_url text,

  -- 再編集用トークンのハッシュ（トークン本体はブラウザの httpOnly Cookie のみに存在）
  edit_token_hash text not null unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint applicants_interview_slots_differ check (interview_at_1 <> interview_at_2),
  constraint applicants_interview_slots_30min check (
    extract(epoch from interview_at_1)::bigint % 1800 = 0
    and extract(epoch from interview_at_2)::bigint % 1800 = 0
  )
);

comment on table public.applicants is 'LP から送信された転職希望者の応募';

create index applicants_created_at_idx on public.applicants (created_at desc);
create index applicants_phone_idx on public.applicants (phone);

-- updated_at の自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger applicants_set_updated_at
  before update on public.applicants
  for each row execute function public.set_updated_at();

-- RLS: 未ログイン（anon）は一切アクセス不可。
-- LP からの保存・読み込みはサーバー側でシークレットキーを使って行う。
alter table public.applicants enable row level security;
revoke all on public.applicants from anon;

create policy "authenticated can read applicants"
  on public.applicants for select
  to authenticated
  using (true);

create policy "authenticated can update applicants"
  on public.applicants for update
  to authenticated
  using (true)
  with check (true);
