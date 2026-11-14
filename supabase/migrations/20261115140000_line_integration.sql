-- =============================================================================
-- LINE 連携
--   line_users              : LINE ユーザーごとの会話の状態（電話番号待ち・入力中・連携済みなど）
--   line_message_templates  : 状態ごとの自動返信の文面（管理画面で編集）
-- =============================================================================

create table public.line_users (
  line_user_id text primary key,
  -- 管理画面のシミュレーターの会話（本物の LINE ユーザーではない。登録・連携はしない）
  is_simulator boolean not null default false,
  state text not null default 'awaiting_phone' check (state in (
    'awaiting_phone',          -- 電話番号を待っている
    'choosing_registration',   -- 未登録: LINE で入力するかフォームで入力するかを選んでもらう
    'reg_name',
    'reg_birth_date',
    'reg_prefecture_region',
    'reg_prefecture',
    'reg_interview_1',
    'reg_interview_2',
    'reg_consent',
    'reg_confirm',
    'linked',                  -- 連携済み
    'locked'                   -- 電話番号の試行回数の上限に達した
  )),
  -- 照合に使った電話番号（未登録の場合は登録に使う）
  phone text,
  -- LINE で入力中の内容
  draft jsonb not null default '{}'::jsonb,
  candidate_id uuid references public.candidates (id) on delete set null,
  phone_attempts integer not null default 0,
  followed boolean not null default true,
  -- LP のフォームで登録したときに LINE とつなぐための使い捨てトークン（ハッシュ）
  link_token_hash text unique,
  link_token_expires_at timestamptz,
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.line_users is 'LINE ユーザーごとの会話の状態';

create trigger line_users_set_updated_at
  before update on public.line_users
  for each row execute function public.set_updated_at();

alter table public.line_users enable row level security;
revoke all on public.line_users from anon;
-- 書き込みはサーバー（シークレットキー）のみ。参照はメンバー
create policy "admin members can read line users"
  on public.line_users for select to authenticated
  using (public.is_admin_member());

create table public.line_message_templates (
  key text primary key,
  -- 送るメッセージ（文字列の配列。空配列 = 送らない）
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.line_message_templates is 'LINE の自動返信の文面。行が無いキーはアプリ側の初期値を使う';

create trigger line_message_templates_set_updated_at
  before update on public.line_message_templates
  for each row execute function public.set_updated_at();

alter table public.line_message_templates enable row level security;
revoke all on public.line_message_templates from anon;
create policy "admin members can read line templates"
  on public.line_message_templates for select to authenticated
  using (public.is_admin_member());
create policy "admin members can insert line templates"
  on public.line_message_templates for insert to authenticated
  with check (public.is_admin_member());
create policy "admin members can update line templates"
  on public.line_message_templates for update to authenticated
  using (public.is_admin_member()) with check (public.is_admin_member());

-- LINE から登録した応募には再編集用トークンが無い
alter table public.applications alter column edit_token_hash drop not null;

-- -----------------------------------------------------------------------------
-- LINE のトークで入力された内容で登録する（人・応募の作成と LINE 連携をまとめて行う）
-- -----------------------------------------------------------------------------
create function public.register_line_entry(
  p_line_user_id text,
  p_full_name text,
  p_birth_date date,
  p_phone text,
  p_prefecture_code smallint,
  p_interview_at_1 timestamptz,
  p_interview_at_2 timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_application_id uuid;
begin
  insert into public.candidates (full_name, birth_date, phone, prefecture_code)
  values (p_full_name, p_birth_date, p_phone, p_prefecture_code)
  on conflict (phone) do nothing
  returning id into v_candidate_id;

  if v_candidate_id is null then
    select c.id into v_candidate_id from public.candidates c where c.phone = p_phone;
  end if;

  -- まだどの LINE ともつながっていない人なら、この LINE とつなぐ
  update public.candidates
    set line_user_id = p_line_user_id, line_linked_at = now()
    where id = v_candidate_id
      and line_user_id is null
      and not exists (select 1 from public.candidates c2 where c2.line_user_id = p_line_user_id);

  insert into public.applications (
    candidate_id, channel,
    full_name, birth_date, phone, prefecture_code,
    interview_at_1, interview_at_2, privacy_consented_at,
    utm_source, utm_medium, utm_campaign
  ) values (
    v_candidate_id, 'line',
    p_full_name, p_birth_date, p_phone, p_prefecture_code,
    p_interview_at_1, p_interview_at_2, now(),
    'line', 'line_chat', 'registration'
  )
  returning id into v_application_id;

  update public.line_users
    set state = 'linked', candidate_id = v_candidate_id, draft = '{}'::jsonb,
        link_token_hash = null, link_token_expires_at = null
    where line_user_id = p_line_user_id;

  return v_application_id;
end;
$$;

revoke execute on function public.register_line_entry(text, text, date, text, smallint, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.register_line_entry(text, text, date, text, smallint, timestamptz, timestamptz)
  to service_role;

-- -----------------------------------------------------------------------------
-- LP フォームの保存: LINE から送った LP のリンク（使い捨てトークン付き）経由なら LINE とつなぐ
-- -----------------------------------------------------------------------------
drop function public.submit_lp_entry(text, text, text, date, text, smallint, timestamptz, timestamptz, uuid, jsonb);

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
  p_attribution jsonb,
  p_line_link_token_hash text default null
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
  v_prev_source text;
  v_prev_medium text;
  v_prev_campaign text;
  v_source text := nullif(btrim(p_attribution ->> 'utmSource'), '');
  v_medium text := nullif(btrim(p_attribution ->> 'utmMedium'), '');
  v_campaign text := nullif(btrim(p_attribution ->> 'utmCampaign'), '');
  v_result text;
  v_final_candidate uuid;
  v_line_user_id text;
begin
  if p_edit_token_hash is not null then
    select a.id, a.candidate_id, a.utm_source, a.utm_medium, a.utm_campaign
      into v_app_id, v_candidate_id, v_prev_source, v_prev_medium, v_prev_campaign
    from public.applications a
    where a.edit_token_hash = p_edit_token_hash
    for update;
  end if;

  -- 違う広告から来た場合は、前回の応募を上書きせず新規として扱う
  if v_app_id is not null
     and (v_source is not null or v_medium is not null or v_campaign is not null)
     and (v_source, v_medium, v_campaign) is distinct from (v_prev_source, v_prev_medium, v_prev_campaign) then
    v_app_id := null;
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
      update public.applications set candidate_id = v_other_id where id = v_app_id;
      if v_app_count = 1 then
        delete from public.candidates where id = v_candidate_id and line_user_id is null;
      end if;
    elsif v_app_count = 1 then
      update public.candidates set
        full_name = p_full_name,
        birth_date = p_birth_date,
        phone = p_phone,
        prefecture_code = p_prefecture_code
      where id = v_candidate_id;
    elsif p_phone <> v_candidate_phone then
      insert into public.candidates (full_name, birth_date, phone, prefecture_code)
      values (p_full_name, p_birth_date, p_phone, p_prefecture_code)
      returning id into v_other_id;
      update public.applications set candidate_id = v_other_id where id = v_app_id;
    end if;

    v_result := 'updated';
  else
    v_candidate_id := null;
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
      v_source, v_medium, v_campaign,
      nullif(p_attribution ->> 'utmTerm', ''),
      nullif(p_attribution ->> 'utmContent', ''),
      nullif(p_attribution ->> 'gclid', ''),
      nullif(p_attribution ->> 'fbclid', ''),
      nullif(p_attribution ->> 'referrer', ''),
      nullif(p_attribution ->> 'landingUrl', ''),
      p_visitor_id, p_new_edit_token_hash
    )
    returning id into v_app_id;

    v_result := 'created';
  end if;

  -- LINE から送った LP のリンク経由なら、この応募の人を LINE とつなぐ
  if p_line_link_token_hash is not null then
    select lu.line_user_id into v_line_user_id
    from public.line_users lu
    where lu.link_token_hash = p_line_link_token_hash
      and lu.link_token_expires_at > now()
      and not lu.is_simulator;

    if v_line_user_id is not null then
      select a.candidate_id into v_final_candidate from public.applications a where a.id = v_app_id;

      update public.candidates
        set line_user_id = v_line_user_id, line_linked_at = now()
        where id = v_final_candidate
          and line_user_id is null
          and not exists (select 1 from public.candidates c2 where c2.line_user_id = v_line_user_id);

      update public.line_users
        set state = 'linked', candidate_id = v_final_candidate, draft = '{}'::jsonb,
            link_token_hash = null, link_token_expires_at = null
        where line_user_id = v_line_user_id;
    end if;
  end if;

  return v_result;
end;
$$;

revoke execute on function public.submit_lp_entry(text, text, text, date, text, smallint, timestamptz, timestamptz, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_lp_entry(text, text, text, date, text, smallint, timestamptz, timestamptz, uuid, jsonb, text)
  to service_role;
