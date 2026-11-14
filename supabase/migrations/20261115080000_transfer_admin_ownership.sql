-- オーナー権限の譲渡（オーナー → 参加済みの管理者）。元のオーナーは管理者になる。
-- 1 つの処理の中で入れ替えるので、オーナーが 0 人・2 人になることはない。
create or replace function public.transfer_admin_ownership(new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
begin
  if current_owner is null
     or not exists (select 1 from public.admin_members where user_id = current_owner and role = 'owner') then
    raise exception 'only the owner can transfer ownership' using errcode = '42501';
  end if;

  if new_owner = current_owner then
    raise exception 'cannot transfer ownership to yourself' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.admin_members m
    join auth.users u on u.id = m.user_id
    where m.user_id = new_owner and m.role = 'admin' and u.email_confirmed_at is not null
  ) then
    raise exception 'new owner must be an active admin' using errcode = '22023';
  end if;

  update public.admin_members set role = 'admin' where user_id = current_owner;
  update public.admin_members set role = 'owner' where user_id = new_owner;
end;
$$;

revoke execute on function public.transfer_admin_ownership(uuid) from public, anon;
grant execute on function public.transfer_admin_ownership(uuid) to authenticated;
