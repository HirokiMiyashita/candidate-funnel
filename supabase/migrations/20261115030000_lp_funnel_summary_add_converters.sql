-- 「LINE・電話・フォームのいずれかを行った人」を重複なしで数える列を追加
-- （以前は各人数の合計で率を出していたため、1 人が複数の行動をすると 100% を超えていた）
drop function if exists public.lp_funnel_summary(timestamptz);

create function public.lp_funnel_summary(since timestamptz)
returns table (
  source text,
  medium text,
  campaign text,
  visitors bigint,
  line_clicks bigint,
  tel_clicks bigint,
  form_submits bigint,
  converters bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(
      e.utm_source,
      nullif(split_part(split_part(e.referrer, '://', 2), '/', 1), ''),
      '(direct)'
    ) as source,
    coalesce(
      e.utm_medium,
      case when e.utm_source is null and e.referrer is not null then 'referral' else '(none)' end
    ) as medium,
    coalesce(e.utm_campaign, '(none)') as campaign,
    count(distinct e.visitor_id) filter (where e.event_type = 'page_view') as visitors,
    count(distinct e.visitor_id) filter (where e.event_type = 'line_click') as line_clicks,
    count(distinct e.visitor_id) filter (where e.event_type = 'tel_click') as tel_clicks,
    count(distinct e.visitor_id) filter (where e.event_type = 'form_submit') as form_submits,
    count(distinct e.visitor_id) filter (
      where e.event_type in ('line_click', 'tel_click', 'form_submit')
    ) as converters
  from public.lp_events e
  where e.created_at >= since
  group by 1, 2, 3
  order by visitors desc, source;
$$;

revoke execute on function public.lp_funnel_summary(timestamptz) from public, anon;
grant execute on function public.lp_funnel_summary(timestamptz) to authenticated;
