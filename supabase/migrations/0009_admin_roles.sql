-- Kelola peran admin. Hanya SUPER_ADMIN yang bisa memakai fungsi ini. Aman dijalankan ulang.
create or replace function public.admin_staff() returns table(
  user_id uuid, email text, full_name text, role text, since timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not has_role(array['SUPER_ADMIN']::app_role[]) then raise exception 'Hanya Super Admin yang boleh' using errcode = '42501'; end if;
  return query
    select r.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', '')::text, r.role::text, r.created_at
    from user_roles r join auth.users u on u.id = r.user_id
    order by (r.role = 'SUPER_ADMIN') desc, u.email;
end $$;

create or replace function public.admin_set_role(p_email text, p_role text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid; v_old text;
begin
  if not has_role(array['SUPER_ADMIN']::app_role[]) then raise exception 'Hanya Super Admin yang boleh' using errcode = '42501'; end if;
  if p_role not in ('SUPER_ADMIN','ADMIN','ORDER_OPERATOR','CUSTOMER_SERVICE') then raise exception 'Role tidak dikenal'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'Email belum terdaftar. Minta orang tersebut mendaftar akun dulu.'; end if;
  select role::text into v_old from user_roles where user_id = v_user order by (role = 'SUPER_ADMIN') desc limit 1;
  if v_old = 'SUPER_ADMIN' and p_role <> 'SUPER_ADMIN'
     and (select count(*) from user_roles where role = 'SUPER_ADMIN') <= 1 then
    raise exception 'Tidak boleh menurunkan Super Admin terakhir.';
  end if;
  delete from user_roles where user_id = v_user;
  insert into user_roles(user_id, role) values (v_user, p_role::app_role);
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'ROLE_SET', 'user', v_user::text, jsonb_build_object('from', v_old, 'to', p_role));
end $$;

create or replace function public.admin_remove_staff(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not has_role(array['SUPER_ADMIN']::app_role[]) then raise exception 'Hanya Super Admin yang boleh' using errcode = '42501'; end if;
  if exists (select 1 from user_roles where user_id = p_user and role = 'SUPER_ADMIN')
     and (select count(*) from user_roles where role = 'SUPER_ADMIN') <= 1 then
    raise exception 'Tidak boleh mencabut Super Admin terakhir.';
  end if;
  delete from user_roles where user_id = p_user;
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'ROLE_REMOVED', 'user', p_user::text, '{}'::jsonb);
end $$;

revoke execute on function public.admin_staff(), public.admin_set_role(text, text), public.admin_remove_staff(uuid) from public, anon;
grant execute on function public.admin_staff(), public.admin_set_role(text, text), public.admin_remove_staff(uuid) to authenticated;
