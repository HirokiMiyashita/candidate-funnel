-- LP の計測イベント（訪問・ボタン押下・フォーム保存）。個人を特定する情報は保存しない
create table public.lp_events (
  id bigint generated always as identity primary key,
  -- ブラウザごとのランダムな ID（訪問者を数え分けるためだけに使う）
  visitor_id uuid not null,
  event_type text not null check (event_type in ('page_view', 'line_click', 'tel_click', 'form_submit')),
  -- ボタンの設置場所（hero = ファーストビュー, sticky_bar = スマホ画面下の固定バー）
  placement text check (placement in ('hero', 'sticky_bar')),
  device text check (device in ('mobile', 'desktop')),

  -- 流入元（そのセッションで最初に LP を開いたときのもの）
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  referrer text,
  landing_url text,

  created_at timestamptz not null default now()
);

comment on table public.lp_events is 'LP の計測イベント（訪問・LINE/電話ボタン押下・フォーム保存）';

create index lp_events_created_at_idx on public.lp_events (created_at desc);
create index lp_events_type_created_at_idx on public.lp_events (event_type, created_at desc);

-- RLS: 書き込みはサーバー（シークレットキー）のみ。参照は管理画面（ログイン済み）のみ
alter table public.lp_events enable row level security;
revoke all on public.lp_events from anon;

create policy "authenticated can read lp events"
  on public.lp_events for select
  to authenticated
  using (true);

-- 流入元ごとの集計（人数はユニークな訪問者数）
create or replace function public.lp_funnel_summary(since timestamptz)
returns table (
  source text,
  medium text,
  campaign text,
  visitors bigint,
  line_clicks bigint,
  tel_clicks bigint,
  form_submits bigint
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
    count(distinct e.visitor_id) filter (where e.event_type = 'form_submit') as form_submits
  from public.lp_events e
  where e.created_at >= since
  group by 1, 2, 3
  order by visitors desc, source;
$$;

-- ボタンの設置場所・端末ごとの押下数（人数）
create or replace function public.lp_click_breakdown(since timestamptz)
returns table (
  event_type text,
  placement text,
  device text,
  clickers bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.event_type, coalesce(e.placement, '(none)'), coalesce(e.device, '(unknown)'), count(distinct e.visitor_id)
  from public.lp_events e
  where e.created_at >= since and e.event_type in ('line_click', 'tel_click')
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

revoke execute on function public.lp_funnel_summary(timestamptz) from public, anon;
revoke execute on function public.lp_click_breakdown(timestamptz) from public, anon;
grant execute on function public.lp_funnel_summary(timestamptz) to authenticated;
grant execute on function public.lp_click_breakdown(timestamptz) to authenticated;
