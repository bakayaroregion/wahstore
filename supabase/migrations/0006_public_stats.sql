-- Angka beranda dihitung dari data asli. Aman dijalankan ulang.
create or replace function public.public_stats() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'orders_completed', (select count(*) from orders where order_status = 'COMPLETED'),
    'customers', (select count(distinct user_id) from orders where order_status = 'COMPLETED' and user_id is not null),
    'repeat_pct', (select case when count(*) > 0 then round(100.0 * count(*) filter (where n >= 2) / count(*)) end
                   from (select count(*) as n from orders where order_status = 'COMPLETED' and user_id is not null group by user_id) t),
    'rating_avg', (select round(avg(rating)::numeric, 1) from testimonials where is_published),
    'rating_count', (select count(*) from testimonials where is_published)) $$;
grant execute on function public.public_stats() to anon, authenticated;
