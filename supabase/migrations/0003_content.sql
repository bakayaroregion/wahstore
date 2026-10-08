-- Konten yang dikelola admin: testimoni asli, jam operasional, poin keunggulan, logo produk. Aman dijalankan ulang.
alter table products add column if not exists logo_url text;

create table if not exists testimonials(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  product_label text,
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 400),
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now());
alter table testimonials enable row level security;
grant select on testimonials to anon, authenticated;
grant insert, update, delete on testimonials to authenticated;
drop policy if exists pub_rev on testimonials;
create policy pub_rev on testimonials for select using (is_published);
drop policy if exists staff_rev on testimonials;
create policy staff_rev on testimonials for all to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[])) with check (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));

-- Angka publik dihitung dari data nyata, bukan ditulis tangan.
create or replace function public.public_stats() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'orders_completed', (select count(*) from orders where order_status = 'COMPLETED'),
    'rating_avg', (select round(avg(rating)::numeric, 1) from testimonials where is_published),
    'rating_count', (select count(*) from testimonials where is_published)) $$;
grant execute on function public.public_stats() to anon, authenticated;

insert into store_settings(key, value, is_public) values
  ('operating_hours', '"Setiap hari, 24 jam"', true),
  ('highlights', '["Harga tampil jelas sebelum pesanan dibuat","Setiap pesanan punya nomor dan kode akses untuk cek status","Konfirmasi dan pembayaran langsung lewat WhatsApp","Pembayaran diverifikasi admin sebelum pesanan diproses","Riwayat status pesanan tercatat"]', true)
on conflict (key) do nothing;
