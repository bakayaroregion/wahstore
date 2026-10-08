# WAHYU STORE: GitHub + Cloudflare Pages + Supabase

Frontend (React + Vite) dipasang di Cloudflare Pages dari GitHub. Data, login admin, dan logika pesanan ada di Supabase.

## 1. Supabase (sekali saja)
1. Buat proyek di supabase.com. Buka SQL Editor, jalankan berurutan: `supabase/migrations/0001_core.sql` `0002_seed.sql`, lalu `0003_content.sql`.
2. Atur nomor WhatsApp toko (format 62..., tanpa +):
   `insert into store_settings(key,value,is_public) values ('whatsapp_number','"6281234567890"',true) on conflict (key) do update set value=excluded.value;`
3. Install Supabase CLI, lalu: `supabase login`, `supabase link --project-ref <ref>`
4. Secret fungsi: `supabase secrets set ORDER_TOKEN_PEPPER=$(openssl rand -hex 32) STORE_BASE_URL=https://nama-proyek.pages.dev`
5. Deploy fungsi: `supabase functions deploy create-order` dan `supabase functions deploy check-order`
6. Buat admin: Authentication > Users > Add user (email + sandi). Lalu SQL Editor:
   `insert into user_roles(user_id, role) select id, 'SUPER_ADMIN' from auth.users where email = 'email-anda';`
7. Authentication > URL Configuration: isi Site URL dengan alamat Cloudflare Pages Anda.

## 2. GitHub
Buat repository kosong (privat disarankan), lalu di folder proyek:
`git init && git add . && git commit -m "WAHYU STORE" && git branch -M main && git remote add origin <url-repo> && git push -u origin main`
File `.env` tidak ikut ter-upload (sudah di `.gitignore`).

## 3. Cloudflare Pages
1. Workers & Pages > Create > Pages > Connect to Git, pilih repository.
2. Build settings: Framework preset **Vite**, Build command `npm run build`, Output directory `dist`.
3. Environment variables (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `NODE_VERSION=20`.
4. Save and Deploy. File `public/_redirects` membuat alamat seperti /admin tetap terbuka saat di-refresh.
5. Domain sendiri: Pages > Custom domains. Jika alamat berubah, perbarui `STORE_BASE_URL` (secret fungsi) dan Site URL Supabase.

## Jalankan lokal
`cp .env.example .env` (isi dua variabel VITE_), `npm install`, `npm run dev`

## Sudah berfungsi
Katalog dari database, pencarian dan filter kategori, keranjang, checkout yang membuat pesanan di server, tautan WhatsApp, cek pesanan dengan kode akses, login admin berbasis role, ringkasan dan daftar pesanan, aksi status (konfirmasi, verifikasi bayar, proses, kirim, selesai, batal, refund) dengan audit log, CRUD produk.

## Belum ada
Upload gambar produk (kartu memakai placeholder huruf), halaman admin untuk kategori, varian, stok digital, kupon, banner, laporan, role, dan audit log (tabelnya ada di database), enkripsi stok digital, tes otomatis. Fungsi dan skema belum diuji pada database nyata, jadi coba dulu di proyek staging.
