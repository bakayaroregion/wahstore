-- Contoh kategori dan produk agar toko tidak kosong. Hapus/ubah lewat admin. Aman dijalankan ulang.
insert into categories(name, slug, sort_order) values
  ('Aplikasi Premium','aplikasi-premium',1), ('Voucher Digital','voucher-digital',2), ('Lisensi Software','lisensi-software',3)
on conflict (slug) do nothing;

insert into products(category_id, name, slug, sku, short_description, price, is_active, labels)
select c.id, v.name, v.slug, v.sku, v.sd, v.price, true, v.labels
from (values
  ('aplikasi-premium','Contoh Aplikasi Premium 1 Bulan','contoh-aplikasi-premium','DEMO-APP-001','Produk contoh. Ganti dari admin.',25000,array['POPULER']),
  ('voucher-digital','Contoh Voucher Digital','contoh-voucher-digital','DEMO-VCH-001','Produk contoh. Ganti dari admin.',50000,array['NEW']),
  ('lisensi-software','Contoh Lisensi Software','contoh-lisensi-software','DEMO-LIC-001','Produk contoh. Ganti dari admin.',100000,array[]::text[])
) as v(cat,name,slug,sku,sd,price,labels)
join categories c on c.slug = v.cat
on conflict (slug) do nothing;
