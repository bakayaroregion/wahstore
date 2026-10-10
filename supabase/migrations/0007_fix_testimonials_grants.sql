-- Perbaikan: "permission denied for table testimonials". Aman dijalankan ulang.
alter table testimonials add column if not exists avatar_url text;
alter table testimonials enable row level security;
grant select on testimonials to anon, authenticated;
grant insert, update, delete on testimonials to authenticated;
drop policy if exists pub_rev on testimonials;
create policy pub_rev on testimonials for select using (is_published);
drop policy if exists staff_rev on testimonials;
create policy staff_rev on testimonials for all to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[])) with check (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));
