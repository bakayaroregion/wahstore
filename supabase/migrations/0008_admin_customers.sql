-- Daftar akun pelanggan untuk admin. Hanya SUPER_ADMIN/ADMIN yang bisa memanggil. Aman dijalankan ulang.
create or replace function public.admin_customers() returns table(
  id uuid, email text, full_name text, phone text, created_at timestamptz, last_sign_in_at timestamptz,
  email_confirmed boolean, orders_total bigint, orders_completed bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text,
           coalesce(u.raw_user_meta_data->>'full_name', '')::text,
           coalesce(u.raw_user_meta_data->>'phone', '')::text,
           u.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
           (select count(*) from orders o where o.user_id = u.id),
           (select count(*) from orders o where o.user_id = u.id and o.order_status = 'COMPLETED')
    from auth.users u
    where not exists (select 1 from user_roles r where r.user_id = u.id)
    order by u.created_at desc;
end $$;
revoke execute on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;
