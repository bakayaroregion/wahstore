-- Foto profil opsional untuk testimoni. Aman dijalankan ulang.
alter table testimonials add column if not exists avatar_url text;
