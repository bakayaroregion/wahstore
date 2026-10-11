-- Pembayaran dua cara: QRIS dan transfer rekening manual + upload bukti. Aman dijalankan ulang.
create table if not exists payment_methods(
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('QRIS','BANK')),
  label text not null check (char_length(label) between 2 and 40),
  account_number text, account_name text, qr_image_url text,
  sort_order int not null default 0, is_active boolean not null default true,
  created_at timestamptz default now());
alter table payment_methods enable row level security;
grant select on payment_methods to authenticated;
grant insert, update, delete on payment_methods to authenticated;
drop policy if exists pm_read on payment_methods;
create policy pm_read on payment_methods for select to authenticated using (is_active or has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));
drop policy if exists pm_staff on payment_methods;
create policy pm_staff on payment_methods for all to authenticated
  using (has_role(array['SUPER_ADMIN','ADMIN']::app_role[])) with check (has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));

alter table orders add column if not exists payment_method text;
alter table orders add column if not exists proof_path text;

-- Bukti transfer: bucket privat. Pembeli hanya boleh unggah ke folder miliknya; staf pesanan boleh melihat.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists proofs_upload on storage.objects;
create policy proofs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists proofs_staff_read on storage.objects;
create policy proofs_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and has_role(array['SUPER_ADMIN','ADMIN','ORDER_OPERATOR']::app_role[]));

-- Pembeli mengirim bukti: pesanan harus miliknya dan belum lunas. Status menjadi menunggu verifikasi.
create or replace function public.submit_payment_proof(p_order_number text, p_method uuid, p_path text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; m payment_methods%rowtype; prev text;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where order_number = p_order_number and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_status not in ('UNPAID','AWAITING_VERIFICATION') or o.order_status = 'CANCELLED' then raise exception 'INVALID_TRANSITION'; end if;
  select * into m from payment_methods where id = p_method and is_active;
  if not found then raise exception 'METHOD_INVALID'; end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'FORBIDDEN'; end if;
  prev := o.payment_status;
  update orders set proof_path = p_path, payment_method = m.kind || ' - ' || m.label, payment_status = 'AWAITING_VERIFICATION' where id = o.id;
  insert into order_status_history(order_id, kind, previous_status, new_status, actor_id, note)
    values (o.id, 'payment', prev, 'AWAITING_VERIFICATION', auth.uid(), 'Bukti pembayaran dikirim pembeli via ' || m.label);
end $$;
revoke execute on function submit_payment_proof(text,uuid,text) from public, anon;
grant execute on function submit_payment_proof(text,uuid,text) to authenticated;
