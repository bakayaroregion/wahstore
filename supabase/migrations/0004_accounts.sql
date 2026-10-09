-- Akun pelanggan, diskon loyalitas bulanan, foto (Storage), dan pengaturan brand. Aman dijalankan ulang.
alter table orders add column if not exists user_id uuid references auth.users on delete set null;
alter table orders add column if not exists loyalty_discount bigint not null default 0 check (loyalty_discount >= 0);
create index if not exists orders_user_idx on orders(user_id, created_at desc);

-- Produk dan harga hanya terbaca oleh akun yang sudah masuk
revoke select on products, product_variants, product_images from anon;
drop policy if exists pub_prod on products;
create policy pub_prod on products for select to authenticated using (is_active and (published_at is null or published_at <= now()));
drop policy if exists pub_var on product_variants;
create policy pub_var on product_variants for select to authenticated
  using (is_active and exists (select 1 from products p where p.id = product_id and p.is_active));
drop policy if exists pub_img on product_images;
create policy pub_img on product_images for select to authenticated
  using (exists (select 1 from products p where p.id = product_id and p.is_active));

-- Loyalitas: berapa bulan berturut-turut (sampai bulan lalu) pelanggan punya pesanan SELESAI.
-- Diskon = persen tertinggi dari loyalty_tiers yang syarat bulannya terpenuhi.
create or replace function public.loyalty_info(p_user uuid, out streak int, out pct int)
language plpgsql stable security definer set search_path=public as $$
declare cur timestamp := date_trunc('month', now() at time zone 'Asia/Jakarta') - interval '1 month'; t jsonb;
begin
  streak := 0; pct := 0;
  if p_user is null then return; end if;
  while streak < 36 and exists (select 1 from orders where user_id = p_user and order_status = 'COMPLETED'
        and date_trunc('month', created_at at time zone 'Asia/Jakarta') = cur) loop
    streak := streak + 1; cur := cur - interval '1 month';
  end loop;
  select value into t from store_settings where key = 'loyalty_tiers';
  if jsonb_typeof(t) = 'array' then
    select coalesce(max((x->>'percent')::int), 0) into pct from jsonb_array_elements(t) x where (x->>'months')::int <= streak;
  end if;
  pct := least(pct, 50);
end $$;

create or replace function public.my_loyalty() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('streak', l.streak, 'percent', l.pct) from loyalty_info(auth.uid()) l $$;

create or replace function public.my_orders() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(s.x order by s.ts desc), '[]'::jsonb) from (
    select o.created_at as ts, jsonb_build_object('order_number', o.order_number, 'created_at', o.created_at, 'grand_total', o.grand_total,
      'loyalty_discount', o.loyalty_discount, 'order_status', o.order_status, 'payment_status', o.payment_status,
      'fulfillment_status', o.fulfillment_status, 'public_note', o.public_note,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'qty', i.quantity)), '[]'::jsonb) from order_items i where i.order_id = o.id)) as x
    from orders o where o.user_id = auth.uid() order by o.created_at desc limit 50) s $$;

revoke execute on function loyalty_info(uuid), my_loyalty(), my_orders() from public, anon;
grant execute on function my_loyalty(), my_orders() to authenticated;

-- create_order versi akun: wajib user, diskon loyalitas ikut dihitung di server
drop function if exists public.create_order(text,text,text,text,text,jsonb,text);
create or replace function public.create_order(p_name text, p_phone text, p_email text, p_note text,
  p_coupon text, p_items jsonb, p_token_hash text, p_user uuid)
returns table(order_id uuid, order_number text, subtotal bigint, discount_total bigint, loyalty_discount bigint, grand_total bigint)
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid := gen_random_uuid(); v_num text; v_sub bigint := 0; v_disc bigint := 0; v_loy bigint := 0; v_pct int;
  it jsonb; p products%rowtype; pv product_variants%rowtype; v_qty int; v_price bigint; v_line bigint; c coupons%rowtype;
begin
  if p_user is null then raise exception 'LOGIN_REQUIRED'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
  v_num := 'WS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into orders(id, order_number, user_id, customer_name, customer_phone, customer_email, customer_note, public_token_hash, subtotal, grand_total)
    values (v_id, v_num, p_user, p_name, p_phone, nullif(p_email, ''), nullif(p_note, ''), p_token_hash, 0, 0);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty not between 1 and 100 then raise exception 'INVALID_QUANTITY'; end if;
    select * into p from products where id = (it->>'product_id')::uuid and is_active and (published_at is null or published_at <= now());
    if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    v_price := p.price; pv := null;
    if nullif(it->>'variant_id', '') is not null then
      select * into pv from product_variants where id = (it->>'variant_id')::uuid and product_id = p.id and is_active;
      if not found then raise exception 'VARIANT_UNAVAILABLE'; end if;
      v_price := coalesce(pv.price_override, p.price);
    end if;
    if p.fulfillment_mode = 'DIGITAL_STOCK' and p.stock_tracking and
       (select count(*) from digital_inventory d where d.product_id = p.id and d.status = 'AVAILABLE'
          and (pv.id is null or d.variant_id is null or d.variant_id = pv.id)) < v_qty then
      raise exception 'OUT_OF_STOCK';
    end if;
    v_line := v_price * v_qty; v_sub := v_sub + v_line;
    insert into order_items(order_id, product_id, variant_id, name_snapshot, sku_snapshot, variant_snapshot, unit_price, quantity, line_total)
      values (v_id, p.id, pv.id, p.name, coalesce(pv.sku, p.sku), pv.name, v_price, v_qty, v_line);
  end loop;

  if nullif(btrim(p_coupon), '') is not null then
    select * into c from coupons where upper(code) = upper(btrim(p_coupon)) and is_active
      and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now()) for update;
    if not found then raise exception 'COUPON_INVALID'; end if;
    if c.usage_limit is not null and c.used_count >= c.usage_limit then raise exception 'COUPON_EXHAUSTED'; end if;
    if v_sub < c.min_purchase then raise exception 'COUPON_MIN_PURCHASE'; end if;
    v_disc := case c.discount_type when 'FIXED' then c.discount_value else v_sub * c.discount_value / 100 end;
    v_disc := least(v_disc, coalesce(c.max_discount, v_disc), v_sub);
    update coupons set used_count = used_count + 1 where id = c.id;
    insert into coupon_redemptions(coupon_id, order_id, customer_phone, discount_amount) values (c.id, v_id, p_phone, v_disc);
  end if;

  select l.pct into v_pct from loyalty_info(p_user) l;
  v_loy := least(v_sub * coalesce(v_pct, 0) / 100, v_sub - v_disc);

  update orders set subtotal = v_sub, discount_total = v_disc + v_loy, loyalty_discount = v_loy, grand_total = v_sub - v_disc - v_loy where id = v_id;
  insert into order_status_history(order_id, kind, new_status, note) values (v_id, 'order', 'PENDING', 'Pesanan dibuat');
  return query select v_id, v_num, v_sub, v_disc + v_loy, v_loy, v_sub - v_disc - v_loy;
end $$;
revoke execute on function create_order(text,text,text,text,text,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function create_order(text,text,text,text,text,jsonb,text,uuid) to service_role;

-- Penyimpanan foto (hanya PNG/JPG/WebP, maks 2 MB). Baca publik, tulis hanya ADMIN.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_staff_write on storage.objects;
create policy media_staff_write on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.has_role(array['SUPER_ADMIN','ADMIN']::app_role[]))
  with check (bucket_id = 'media' and public.has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));

-- Pengaturan awal brand dan tingkat diskon loyalitas (ubah dari menu Konten di admin)
insert into store_settings(key, value, is_public) values
  ('brand_name', '"WAHYU STORE"', true), ('brand_tagline', '"Toko Produk Digital"', true), ('brand_logo_url', '""', true),
  ('loyalty_tiers', '[{"months":2,"percent":3},{"months":3,"percent":5},{"months":6,"percent":10}]', true)
on conflict (key) do nothing;
