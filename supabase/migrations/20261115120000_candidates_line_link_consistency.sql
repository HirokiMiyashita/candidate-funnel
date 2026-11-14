-- LINE 連携は line_user_id の有無で判断する。連携日時と食い違わないよう、両方あるか両方ないかに限定する
alter table public.candidates
  add constraint candidates_line_link_consistent
  check ((line_user_id is null) = (line_linked_at is null));

comment on column public.candidates.line_user_id is 'LINE ユーザー ID。値があれば LINE 連携済み';
comment on column public.candidates.line_linked_at is 'LINE 連携した日時（line_user_id と必ずセット）';
