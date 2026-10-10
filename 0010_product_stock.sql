-- Status stok untuk katalog (hanya pelanggan yang sudah masuk). Aturannya sama dengan pengecekan saat membuat pesanan.
create or replace function public.product_stock() returns table(product_id uuid, in_stock boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
    case when p.fulfillment_mode = 'DIGITAL_STOCK' and p.stock_tracking
      then exists (select 1 from digital_inventory d where d.product_id = p.id and d.status = 'AVAILABLE')
      else true end
  from products p where p.is_active and (p.published_at is null or p.published_at <= now()) $$;
revoke execute on function public.product_stock() from public, anon;
grant execute on function public.product_stock() to authenticated;
