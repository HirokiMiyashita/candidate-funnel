-- 同じブラウザ（再編集用 Cookie あり）でも、前回と違う広告（utm_source / utm_medium / utm_campaign）
-- から来た場合は前回の応募を上書きせず、新しい応募として保存する。
-- 今回の流入に utm が無い場合は、これまでどおり前回の応募の編集とする。
create or replace function public.submit_lp_entry(
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
  v_prev_source text;
  v_prev_medium text;
  v_prev_campaign text;
  v_source text := nullif(btrim(p_attribution ->> 'utmSource'), '');
  v_medium text := nullif(btrim(p_attribution ->> 'utmMedium'), '');
  v_campaign text := nullif(btrim(p_attribution ->> 'utmCampaign'), '');
begin
  -- 再編集（Cookie のトークンに対応する応募がある）
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

    return 'updated';
  end if;

  -- 新規（同じ電話番号の人がいればその人の応募として追加し、その人の情報は上書きしない）
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
  );

  return 'created';
end;
$$;
