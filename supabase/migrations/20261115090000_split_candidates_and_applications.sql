-- =============================================================================
-- 「人」と「応募」を分ける
--   candidates   : 転職希望者その人（電話番号で 1 人を識別。LINE ユーザー ID もここに付く）
--   applications : 応募・相談 1 回ずつ（旧 applicants）。入力内容はその時点の控えとして残す
-- =============================================================================

-- 1. 転職希望者
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 100),
  birth_date date,
  -- ハイフンなしに正規化した電話番号。1 人を識別するキー
  phone text not null unique check (phone ~ '^0[0-9]{9,10}$'),
  prefecture_code smallint check (prefecture_code between 1 and 47),
  -- LINE 連携（LINE で電話番号を照合できたときに保存）
  line_user_id text unique,
  line_linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.candidates is '転職希望者その人。電話番号で識別し、LINE ユーザー ID もここに付く';

create trigger candidates_set_updated_at
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- 2. 名前の変更（applicants → applications / applicant_statuses → application_statuses）
alter table public.applicants rename to applications;
alter table public.applicant_statuses rename to application_statuses;

alter index public.applicants_created_at_idx rename to applications_created_at_idx;
alter index public.applicants_phone_idx rename to applications_phone_idx;
alter index public.applicants_status_id_idx rename to applications_status_id_idx;
alter index public.applicants_visitor_id_idx rename to applications_visitor_id_idx;
alter index public.applicant_statuses_name_key rename to application_statuses_name_key;
alter index public.applicant_statuses_one_default rename to application_statuses_one_default;

alter policy "admin members can read applicants" on public.applications rename to "admin members can read applications";
alter policy "admin members can update applicants" on public.applications rename to "admin members can update applications";
alter policy "admin members can read applicant statuses" on public.application_statuses rename to "admin members can read application statuses";
alter policy "admin members can insert applicant statuses" on public.application_statuses rename to "admin members can insert application statuses";
alter policy "admin members can update applicant statuses" on public.application_statuses rename to "admin members can update application statuses";
alter policy "admin members can delete applicant statuses" on public.application_statuses rename to "admin members can delete application statuses";

comment on table public.applications is '応募・相談 1 回ずつ。氏名などの入力内容は応募時点の控え（本人の情報は candidates）';
comment on table public.application_statuses is '応募の対応状況（電話済み・日程再調整など）。管理画面で編集';

-- 3. 応募に「どの人か」と「経路」を追加
alter table public.applications
  add column candidate_id uuid references public.candidates (id) on delete cascade,
  add column channel text not null default 'lp_form' check (channel in ('lp_form', 'line'));

-- 4. 既存の応募から転職希望者を作る（同じ電話番号は 1 人。情報は最新の応募、作成日時は最初の応募）
insert into public.candidates (full_name, birth_date, phone, prefecture_code, created_at)
select distinct on (a.phone)
  a.full_name, a.birth_date, a.phone, a.prefecture_code,
  min(a.created_at) over (partition by a.phone)
from public.applications a
order by a.phone, a.created_at desc;

update public.applications a
  set candidate_id = c.id
  from public.candidates c
  where c.phone = a.phone;

alter table public.applications alter column candidate_id set not null;
create index applications_candidate_id_idx on public.applications (candidate_id);

-- 5. RLS: 転職希望者は管理画面のメンバーのみ
alter table public.candidates enable row level security;
revoke all on public.candidates from anon;

create policy "admin members can read candidates"
  on public.candidates for select to authenticated
  using (public.is_admin_member());
create policy "admin members can update candidates"
  on public.candidates for update to authenticated
  using (public.is_admin_member()) with check (public.is_admin_member());

-- 6. テーブル名を参照している関数を作り直す
drop trigger applicants_default_status on public.applications;
drop function public.applicants_set_default_status();

create function public.applications_set_default_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status_id is null then
    select id into new.status_id from public.application_statuses where is_default limit 1;
  end if;
  return new;
end;
$$;

create trigger applications_default_status
  before insert on public.applications
  for each row execute function public.applications_set_default_status();

drop function public.set_default_applicant_status(uuid);
create function public.set_default_application_status(target uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.application_statuses where id = target) then
    raise exception 'status not found';
  end if;
  update public.application_statuses set is_default = false where is_default and id <> target;
  update public.application_statuses set is_default = true where id = target;
end;
$$;

drop function public.reorder_applicant_statuses(uuid[]);
create function public.reorder_application_statuses(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.application_statuses s
  set sort_order = t.ord
  from unnest(ids) with ordinality as t(id, ord)
  where s.id = t.id;
$$;

drop function public.applicant_status_counts();
create function public.application_status_counts()
returns table (status_id uuid, applications bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.status_id, count(*) from public.applications a group by a.status_id;
$$;

drop function public.applicant_contact_clicks(uuid[]);
create function public.application_contact_clicks(ids uuid[])
returns table (application_id uuid, line_clicked_at timestamptz, tel_clicked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    min(e.created_at) filter (where e.event_type = 'line_click'),
    min(e.created_at) filter (where e.event_type = 'tel_click')
  from public.applications a
  join public.lp_events e on e.visitor_id = a.visitor_id
  where a.id = any (ids)
    and e.event_type in ('line_click', 'tel_click')
  group by a.id;
$$;

revoke execute on function public.set_default_application_status(uuid) from public, anon;
revoke execute on function public.reorder_application_statuses(uuid[]) from public, anon;
revoke execute on function public.application_status_counts() from public, anon;
revoke execute on function public.application_contact_clicks(uuid[]) from public, anon;
grant execute on function public.set_default_application_status(uuid) to authenticated;
grant execute on function public.reorder_application_statuses(uuid[]) to authenticated;
grant execute on function public.application_status_counts() to authenticated;
grant execute on function public.application_contact_clicks(uuid[]) to authenticated;

-- 7. LP フォームの保存（新規・再編集）を 1 つの処理で行う。サーバー（シークレットキー）専用
--    ルール:
--    - 新規: 電話番号が同じ人がいればその人の応募として追加（その人の情報は上書きしない）。
--            いなければ人を新しく作る
--    - 再編集: 応募の入力内容（控え）を更新する。
--            この応募しか無い人なら、本人の訂正として人の情報も更新する。
--            電話番号が他の人のものに変わった場合はその人に付け替える（相手の情報は上書きしない）
create function public.submit_lp_entry(
  p_edit_token_hash text,
  p_new_edit_token_hash text,
  p_full_name text,
  p_birth_date date,
  p_phone text,
  p_prefecture_code smallint,
  p_interview_at_1 timestamptz,
  p_interview_at_2 timestamptz,
  p_visitor_id uuid,
  p_attribution jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_app_id uuid;
  v_candidate_id uuid;
  v_candidate_phone text;
  v_app_count integer;
  v_other_id uuid;
begin
  -- 再編集（Cookie のトークンに対応する応募がある）
  if p_edit_token_hash is not null then
    select a.id, a.candidate_id into v_app_id, v_candidate_id
    from public.applications a
    where a.edit_token_hash = p_edit_token_hash
    for update;
  end if;

  if v_app_id is not null then
    update public.applications set
      full_name = p_full_name,
      birth_date = p_birth_date,
      phone = p_phone,
      prefecture_code = p_prefecture_code,
      interview_at_1 = p_interview_at_1,
      interview_at_2 = p_interview_at_2,
      privacy_consented_at = now(),
      visitor_id = coalesce(visitor_id, p_visitor_id)
    where id = v_app_id;

    select c.phone into v_candidate_phone from public.candidates c where c.id = v_candidate_id;
    select count(*) into v_app_count from public.applications where candidate_id = v_candidate_id;
    select c.id into v_other_id from public.candidates c where c.phone = p_phone and c.id <> v_candidate_id;

    if v_other_id is not null then
      -- 他の人の電話番号に変わった → その人の応募に付け替える（相手の情報は上書きしない）
      update public.applications set candidate_id = v_other_id where id = v_app_id;
      if v_app_count = 1 then
        delete from public.candidates where id = v_candidate_id and line_user_id is null;
      end if;
    elsif v_app_count = 1 then
      -- この応募しか無い人 → 本人の訂正として反映
      update public.candidates set
        full_name = p_full_name,
        birth_date = p_birth_date,
        phone = p_phone,
        prefecture_code = p_prefecture_code
      where id = v_candidate_id;
    elsif p_phone <> v_candidate_phone then
      -- 応募が複数ある人で、まだ誰のものでもない電話番号に変わった → 別の人として分ける
      insert into public.candidates (full_name, birth_date, phone, prefecture_code)
      values (p_full_name, p_birth_date, p_phone, p_prefecture_code)
      returning id into v_other_id;
      update public.applications set candidate_id = v_other_id where id = v_app_id;
    end if;

    return 'updated';
  end if;

  -- 新規
  insert into public.candidates (full_name, birth_date, phone, prefecture_code)
  values (p_full_name, p_birth_date, p_phone, p_prefecture_code)
  on conflict (phone) do nothing
  returning id into v_candidate_id;

  if v_candidate_id is null then
    select c.id into v_candidate_id from public.candidates c where c.phone = p_phone;
  end if;

  insert into public.applications (
    candidate_id, channel,
    full_name, birth_date, phone, prefecture_code,
    interview_at_1, interview_at_2, privacy_consented_at,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    gclid, fbclid, referrer, landing_url,
    visitor_id, edit_token_hash
  ) values (
    v_candidate_id, 'lp_form',
    p_full_name, p_birth_date, p_phone, p_prefecture_code,
    p_interview_at_1, p_interview_at_2, now(),
    nullif(p_attribution ->> 'utmSource', ''),
    nullif(p_attribution ->> 'utmMedium', ''),
    nullif(p_attribution ->> 'utmCampaign', ''),
    nullif(p_attribution ->> 'utmTerm', ''),
    nullif(p_attribution ->> 'utmContent', ''),
    nullif(p_attribution ->> 'gclid', ''),
    nullif(p_attribution ->> 'fbclid', ''),
    nullif(p_attribution ->> 'referrer', ''),
    nullif(p_attribution ->> 'landingUrl', ''),
    p_visitor_id, p_new_edit_token_hash
  );

  return 'created';
end;
$$;

revoke execute on function public.submit_lp_entry(text, text, text, date, text, smallint, timestamptz, timestamptz, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_lp_entry(text, text, text, date, text, smallint, timestamptz, timestamptz, uuid, jsonb)
  to service_role;
