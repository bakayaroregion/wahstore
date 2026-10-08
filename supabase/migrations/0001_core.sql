-- WAHYU STORE: inti database (katalog, pesanan, kupon, stok digital, audit, RLS)
-- Dapat dijalankan ulang. Tabel banners, pages, notifications, profiles menyusul di 0002.

do $$ begin create type app_role as enum ('SUPER_ADMIN','ADMIN','ORDER_OPERATOR','CUSTOMER_SERVICE');
exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists user_roles(
  user_id uuid references auth.users on delete cascade, role app_role not null,
  created_at timestamptz default now(), primary key(user_id, role));

create or replace function public.has_role(roles app_role[]) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from user_roles where user_id = auth.uid() and role = any(roles)) $$;

create table if not exists categories(
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  description text, image_url text, sort_order int not null default 0, is_active boolean not null default true,
  seo_title text, seo_description text, created_at timestamptz default now(), updated_at timestamptz default now());

create table if not exists products(
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories on delete restrict,
  name text not null, slug text unique not null, sku text unique not null,
  short_description text, description text,
  product_type text not null default 'DIGITAL' check (product_type in ('APK','VOUCHER','ACCOUNT','LICENSE','SUBSCRIPTION','DIGITAL')),
  fulfillment_mode text not null default 'MANUAL' check (fulfillment_mode in ('MANUAL','DIGITAL_STOCK','PROVIDER_API')),
  price bigint not null check (price >= 0), compare_at_price bigint check (compare_at_price >= 0),
  cost_price bigint check (cost_price >= 0), stock_tracking boolean not null default false,
  is_active boolean not null default false, is_featured boolean not null default false,
  labels text[] not null default '{}', published_at timestamptz,
  seo_title text, seo_description text, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists products_cat_idx on products(category_id) where is_active;

create table if not exists product_variants(
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products on delete cascade,
  name text not null, sku text unique not null, price_override bigint check (price_override >= 0),
  is_active boolean not null default true, created_at timestamptz default now());

create table if not exists product_images(
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products on delete cascade,
  storage_path text not null, alt_text text not null default '', sort_order int not null default 0);

create table if not exists store_settings(
  key text primary key, value jsonb not null, is_public boolean not null default false,
  updated_at timestamptz default now(), updated_by uuid references auth.users);

create table if not exists coupons(
  id uuid primary key default gen_random_uuid(), code text not null,
  discount_type text not null check (discount_type in ('PERCENT','FIXED')),
  discount_value bigint not null check (discount_value > 0), min_purchase bigint not null default 0,
  max_discount bigint, usage_limit int, used_count int not null default 0,
  starts_at timestamptz, expires_at timestamptz, is_active boolean not null default true);
create unique index if not exists coupons_code_uq on coupons(upper(code));

create table if not exists orders(
  id uuid primary key default gen_random_uuid(), order_number text unique not null,
  customer_name text not null, customer_phone text not null, customer_email text,
  public_token_hash text not null,
  subtotal bigint not null check (subtotal >= 0), discount_total bigint not null default 0 check (discount_total >= 0),
  grand_total bigint not null check (grand_total >= 0),
  order_status text not null default 'PENDING' check (order_status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','AWAITING_VERIFICATION','PAID','FAILED','REFUNDED')),
  fulfillment_status text not null default 'NOT_STARTED' check (fulfillment_status in ('NOT_STARTED','PROCESSING','DELIVERED','FAILED')),
  customer_note text, internal_note text, public_note text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists orders_created_idx on orders(created_at desc);
create index if not exists orders_phone_idx on orders(customer_phone);

create table if not exists order_items(
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders on delete cascade,
  product_id uuid references products on delete set null, variant_id uuid references product_variants on delete set null,
  name_snapshot text not null, sku_snapshot text not null, variant_snapshot text,
  unit_price bigint not null check (unit_price >= 0), quantity int not null check (quantity between 1 and 100),
  line_total bigint not null check (line_total >= 0), fulfillment_status text not null default 'NOT_STARTED');

create table if not exists coupon_redemptions(
  id uuid primary key default gen_random_uuid(), coupon_id uuid not null references coupons,
  order_id uuid unique not null references orders on delete cascade,
  customer_phone text, discount_amount bigint not null, created_at timestamptz default now());

create table if not exists order_status_history(
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders on delete cascade,
  kind text not null, previous_status text, new_status text not null,
  actor_id uuid references auth.users, note text, created_at timestamptz default now());

create table if not exists payment_records(
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders on delete cascade,
  method text not null, amount bigint not null check (amount >= 0), status text not null,
  reference text, verified_by uuid references auth.users, verified_at timestamptz, notes text,
  created_at timestamptz default now());

create table if not exists audit_logs(
  id bigint generated always as identity primary key, actor_id uuid, action text not null,
  entity_type text not null, entity_id text, metadata jsonb not null default '{}', created_at timestamptz default now());
create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'AUDIT_LOG_IMMUTABLE'; end $$;
drop trigger if exists audit_no_change on audit_logs;
create trigger audit_no_change before update or delete on audit_logs for each row execute function audit_immutable();

-- Isi rahasia dienkripsi di aplikasi (ENCRYPTION_KEY) sebelum disimpan. Tidak pernah dibaca langsung dari browser.
create table if not exists digital_inventory(
  id uuid primary key default gen_random_uuid(), product_id uuid not null references products,
  variant_id uuid references product_variants, secret_ciphertext text not null, secret_hash text unique not null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','RESERVED','SOLD','DISABLED')),
  allocated_order_item_id uuid references order_items, created_at timestamptz default now(),
  allocated_at timestamptz, delivered_at timestamptz);
create index if not exists inv_avail_idx on digital_inventory(product_id, variant_id) where status = 'AVAILABLE';

do $$ declare t text; begin
  foreach t in array array['categories','products','orders'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop; end $$;

-- ============ FUNGSI BISNIS (hanya lewat backend) ============

-- Server menghitung ulang semua harga. Error apa pun membatalkan seluruh transaksi.
create or replace function public.create_order(p_name text, p_phone text, p_email text, p_note text,
  p_coupon text, p_items jsonb, p_token_hash text)
returns table(order_id uuid, order_number text, subtotal bigint, discount_total bigint, grand_total bigint)
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid := gen_random_uuid(); v_num text; v_sub bigint := 0; v_disc bigint := 0;
  it jsonb; p products%rowtype; pv product_variants%rowtype; v_qty int; v_price bigint; v_line bigint; c coupons%rowtype;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'INVALID_ITEMS'; end if;
  v_num := 'WS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into orders(id, order_number, customer_name, customer_phone, customer_email, customer_note, public_token_hash, subtotal, grand_total)
    values (v_id, v_num, p_name, p_phone, nullif(p_email, ''), nullif(p_note, ''), p_token_hash, 0, 0);

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

  update orders set subtotal = v_sub, discount_total = v_disc, grand_total = v_sub - v_disc where id = v_id;
  insert into order_status_history(order_id, kind, new_status, note) values (v_id, 'order', 'PENDING', 'Pesanan dibuat');
  return query select v_id, v_num, v_sub, v_disc, v_sub - v_disc;
end $$;

-- Cek pesanan publik: butuh nomor + token. Gagal selalu mengembalikan null (tidak membocorkan apa pun).
create or replace function public.check_order(p_number text, p_token_hash text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('order_number', o.order_number, 'created_at', o.created_at, 'grand_total', o.grand_total,
    'order_status', o.order_status, 'payment_status', o.payment_status, 'fulfillment_status', o.fulfillment_status,
    'public_note', o.public_note,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'variant', i.variant_snapshot, 'qty', i.quantity, 'total', i.line_total)), '[]')
              from order_items i where i.order_id = o.id))
  from orders o where o.order_number = p_number and o.public_token_hash = p_token_hash $$;

-- Transisi status dengan aturan ketat, riwayat, dan audit log. Dipanggil admin lewat rpc().
create or replace function public.admin_transition(p_order uuid, p_kind text, p_new text, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; prev text; ok boolean := false;
begin
  if not has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_kind = 'order' then
    prev := o.order_status;
    ok := (prev, p_new) in (('PENDING','CONFIRMED'),('PENDING','CANCELLED'),('CONFIRMED','COMPLETED'),('CONFIRMED','CANCELLED'));
    if ok and p_new = 'COMPLETED' and (o.payment_status <> 'PAID' or o.fulfillment_status <> 'DELIVERED') then raise exception 'NOT_PAID_OR_DELIVERED'; end if;
    if ok and p_new = 'CANCELLED' and o.payment_status = 'PAID' then raise exception 'REFUND_FIRST'; end if;
  elsif p_kind = 'payment' then
    prev := o.payment_status;
    ok := (prev, p_new) in (('UNPAID','AWAITING_VERIFICATION'),('UNPAID','PAID'),('AWAITING_VERIFICATION','PAID'),
                            ('UNPAID','FAILED'),('AWAITING_VERIFICATION','FAILED'),('PAID','REFUNDED'));
  elsif p_kind = 'fulfillment' then
    prev := o.fulfillment_status;
    ok := (prev, p_new) in (('NOT_STARTED','PROCESSING'),('PROCESSING','DELIVERED'),('PROCESSING','FAILED'),('FAILED','PROCESSING'));
    if ok and p_new = 'PROCESSING' and o.payment_status <> 'PAID' then raise exception 'NOT_PAID'; end if;
  else raise exception 'BAD_KIND'; end if;
  if not ok then raise exception 'INVALID_TRANSITION'; end if;
  if p_new in ('CANCELLED','REFUNDED','FAILED') and coalesce(btrim(p_note), '') = '' then raise exception 'REASON_REQUIRED'; end if;

  if p_kind = 'order' then update orders set order_status = p_new where id = p_order;
  elsif p_kind = 'payment' then update orders set payment_status = p_new where id = p_order;
  else update orders set fulfillment_status = p_new where id = p_order; end if;
  if p_kind = 'payment' and p_new = 'PAID' then
    insert into payment_records(order_id, method, amount, status, verified_by, verified_at, notes)
      values (p_order, 'MANUAL', o.grand_total, 'PAID', auth.uid(), now(), p_note);
  end if;
  insert into order_status_history(order_id, kind, previous_status, new_status, actor_id, note) values (p_order, p_kind, prev, p_new, auth.uid(), p_note);
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'ORDER_' || upper(p_kind) || '_' || p_new, 'order', p_order::text, jsonb_build_object('from', prev, 'to', p_new));
end $$;

-- Alokasi 1 unit stok digital ke 1 item pesanan. SKIP LOCKED mencegah stok yang sama dijual dua kali.
create or replace function public.allocate_inventory(p_item uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare i order_items%rowtype; o orders%rowtype; v_inv uuid;
begin
  if not has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into i from order_items where id = p_item; if not found then raise exception 'NOT_FOUND'; end if;
  select * into o from orders where id = i.order_id for update;
  if o.payment_status <> 'PAID' then raise exception 'NOT_PAID'; end if;
  if (select count(*) from digital_inventory where allocated_order_item_id = p_item) >= i.quantity then raise exception 'ALREADY_ALLOCATED'; end if;
  select d.id into v_inv from digital_inventory d where d.product_id = i.product_id and d.status = 'AVAILABLE'
    and (d.variant_id is null or d.variant_id = i.variant_id) order by d.created_at for update skip locked limit 1;
  if v_inv is null then raise exception 'OUT_OF_STOCK'; end if;
  update digital_inventory set status = 'SOLD', allocated_order_item_id = p_item, allocated_at = now() where id = v_inv;
  insert into audit_logs(actor_id, action, entity_type, entity_id) values (auth.uid(), 'INVENTORY_ALLOCATED', 'order_item', p_item::text);
  return v_inv;
end $$;

revoke execute on function create_order(text,text,text,text,text,jsonb,text), check_order(text,text) from public, anon, authenticated;
grant execute on function create_order(text,text,text,text,text,jsonb,text), check_order(text,text) to service_role;
revoke execute on function admin_transition(uuid,text,text,text), allocate_inventory(uuid) from public, anon;
grant execute on function admin_transition(uuid,text,text,text), allocate_inventory(uuid) to authenticated;

-- ============ RLS ============
revoke all on all tables in schema public from anon, authenticated;
grant select on categories, products, product_variants, product_images, store_settings to anon, authenticated;
grant insert, update, delete on categories, products, product_variants, product_images, store_settings, coupons to authenticated;
grant select on orders, order_items, order_status_history, payment_records, audit_logs, coupons, user_roles to authenticated;
grant update (internal_note, public_note) on orders to authenticated;

do $$ declare t text; begin
  foreach t in array array['user_roles','categories','products','product_variants','product_images','store_settings','coupons',
    'orders','order_items','order_status_history','payment_records','audit_logs','digital_inventory','coupon_redemptions'] loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

-- Publik: hanya yang aktif dan sudah terbit
drop policy if exists pub_cat on categories;  create policy pub_cat on categories for select using (is_active);
drop policy if exists pub_prod on products;   create policy pub_prod on products for select using (is_active and (published_at is null or published_at <= now()));
drop policy if exists pub_var on product_variants; create policy pub_var on product_variants for select
  using (is_active and exists (select 1 from products p where p.id = product_id and p.is_active));
drop policy if exists pub_img on product_images; create policy pub_img on product_images for select
  using (exists (select 1 from products p where p.id = product_id and p.is_active));
drop policy if exists pub_set on store_settings; create policy pub_set on store_settings for select using (is_public);

-- Staf katalog
do $$ declare t text; begin
  foreach t in array array['categories','products','product_variants','product_images','store_settings'] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format($f$create policy staff_all on %I for all to authenticated
      using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[])) with check (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]))$f$, t);
  end loop; end $$;
drop policy if exists staff_coupons on coupons; create policy staff_coupons on coupons for all to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[])) with check (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));

-- Pesanan: staf hanya membaca. Perubahan status wajib lewat admin_transition().
do $$ declare t text; begin
  foreach t in array array['orders','order_items','order_status_history','payment_records'] loop
    execute format('drop policy if exists staff_read on %I', t);
    execute format($f$create policy staff_read on %I for select to authenticated
      using (has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR','CUSTOMER_SERVICE']::app_role[]))$f$, t);
  end loop; end $$;
drop policy if exists staff_note on orders; create policy staff_note on orders for update to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR','CUSTOMER_SERVICE']::app_role[]))
  with check (has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR','CUSTOMER_SERVICE']::app_role[]));
drop policy if exists audit_read on audit_logs; create policy audit_read on audit_logs for select to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));
drop policy if exists roles_read on user_roles; create policy roles_read on user_roles for select to authenticated
  using (user_id = auth.uid() or has_role(array['SUPER_ADMIN']::app_role[]));
-- digital_inventory & coupon_redemptions: sengaja tanpa policy (hanya service_role / fungsi security definer).
-- Membuat SUPER_ADMIN pertama: lihat README.
