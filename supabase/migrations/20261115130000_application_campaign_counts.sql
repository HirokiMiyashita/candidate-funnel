-- 応募一覧の「流入元」絞り込みの選択肢（広告の組み合わせごとの応募件数）
create or replace function public.application_campaign_counts()
returns table (utm_source text, utm_medium text, utm_campaign text, applications bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.utm_source, a.utm_medium, a.utm_campaign, count(*)
  from public.applications a
  group by 1, 2, 3
  order by 4 desc, 1 nulls last, 2 nulls last, 3 nulls last;
$$;

revoke execute on function public.application_campaign_counts() from public, anon;
grant execute on function public.application_campaign_counts() to authenticated;
