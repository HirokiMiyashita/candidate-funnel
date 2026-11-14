-- 応募と LP の計測（訪問者 ID）をつなげ、応募一覧で LINE・電話ボタンの押下を表示できるようにする
alter table public.applicants add column visitor_id uuid;

create index applicants_visitor_id_idx on public.applicants (visitor_id);
create index lp_events_visitor_type_idx on public.lp_events (visitor_id, event_type);

-- 応募ごとの LINE・電話ボタンの最初の押下日時（同じブラウザでの記録）
create or replace function public.applicant_contact_clicks(ids uuid[])
returns table (applicant_id uuid, line_clicked_at timestamptz, tel_clicked_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    min(e.created_at) filter (where e.event_type = 'line_click'),
    min(e.created_at) filter (where e.event_type = 'tel_click')
  from public.applicants a
  join public.lp_events e on e.visitor_id = a.visitor_id
  where a.id = any (ids)
    and e.event_type in ('line_click', 'tel_click')
  group by a.id;
$$;

revoke execute on function public.applicant_contact_clicks(uuid[]) from public, anon;
grant execute on function public.applicant_contact_clicks(uuid[]) to authenticated;
