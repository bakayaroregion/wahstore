-- Saldo member: dompet, riwayat (ledger), isi saldo dengan bukti, bayar pesanan pakai saldo. Aman dijalankan ulang.
-- Saldo HANYA berubah lewat fungsi di bawah (security definer). Browser tidak bisa menulis langsung.
create table if not exists wallets(
  user_id uuid primary key references auth.users on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz default now());

create table if not exists wallet_transactions(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('DEPOSIT','PURCHASE','REFUND','ADJUST')),
  amount bigint not null check (amount <> 0),          -- positif = masuk, negatif = keluar
  balance_after bigint not null check (balance_after >= 0),
  ref text, note text, actor_id uuid,
  created_at timestamptz default now());
create index if not exists wtx_user_idx on wallet_transactions(user_id, created_at desc);

create table if not exists wallet_deposits(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  user_email text,
  amount bigint not null check (amount between 10000 and 10000000),
  method_label text not null, proof_path text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  note text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz default now());
create index if not exists wdep_user_idx on wallet_deposits(user_id, created_at desc);
create index if not exists wdep_status_idx on wallet_deposits(status, created_at);

alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table wallet_deposits enable row level security;
revoke all on wallets, wallet_transactions, wallet_deposits from anon, authenticated;
grant select on wallets, wallet_transactions, wallet_deposits to authenticated;
drop policy if exists w_own on wallets;
create policy w_own on wallets for select to authenticated using (user_id = auth.uid() or has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));
drop policy if exists wtx_own on wallet_transactions;
create policy wtx_own on wallet_transactions for select to authenticated using (user_id = auth.uid() or has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));
drop policy if exists wdep_own on wallet_deposits;
create policy wdep_own on wallet_deposits for select to authenticated using (user_id = auth.uid() or has_role(array['SUPER_ADMIN','ADMIN']::app_role[]));

-- Satu-satunya jalan mengubah saldo. Kunci baris dompet, tolak saldo minus, catat riwayat.
create or replace function public._wallet_move(p_user uuid, p_amount bigint, p_kind text, p_ref text, p_note text, p_actor uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_bal bigint;
begin
  insert into wallets(user_id) values (p_user) on conflict do nothing;
  select balance into v_bal from wallets where user_id = p_user for update;
  if v_bal + p_amount < 0 then raise exception 'INSUFFICIENT_BALANCE'; end if;
  v_bal := v_bal + p_amount;
  update wallets set balance = v_bal, updated_at = now() where user_id = p_user;
  insert into wallet_transactions(user_id, kind, amount, balance_after, ref, note, actor_id)
    values (p_user, p_kind, p_amount, v_bal, p_ref, p_note, p_actor);
  return v_bal;
end $$;
revoke execute on function public._wallet_move(uuid,bigint,text,text,text,uuid) from public, anon, authenticated;

create or replace function public.my_wallet() returns bigint
language sql stable security definer set search_path=public as $$
  select coalesce((select balance from wallets where user_id = auth.uid()), 0) $$;
revoke execute on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;

-- Pembeli mengajukan isi saldo (bukti transfer sudah diunggah ke bucket proofs/<uid>/...). Menunggu persetujuan admin.
create or replace function public.request_deposit(p_amount bigint, p_method uuid, p_path text)
returns uuid language plpgsql security definer set search_path=public as $$
declare m payment_methods%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_amount < 10000 or p_amount > 10000000 then raise exception 'AMOUNT_INVALID'; end if;
  select * into m from payment_methods where id = p_method and is_active;
  if not found then raise exception 'METHOD_INVALID'; end if;
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'FORBIDDEN'; end if;
  if (select count(*) from wallet_deposits where user_id = auth.uid() and status = 'PENDING') >= 5 then raise exception 'TOO_MANY_PENDING'; end if;
  insert into wallet_deposits(user_id, user_email, amount, method_label, proof_path)
    values (auth.uid(), auth.jwt()->>'email', p_amount, m.kind || ' - ' || m.label, p_path) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.request_deposit(bigint,uuid,text) from public, anon;
grant execute on function public.request_deposit(bigint,uuid,text) to authenticated;

-- Admin menyetujui / menolak isi saldo. Hanya ADMIN ke atas. Menolak wajib beri alasan.
create or replace function public.admin_review_deposit(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare d wallet_deposits%rowtype;
begin
  if not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into d from wallet_deposits where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.status <> 'PENDING' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_approve and coalesce(btrim(p_note), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  if p_approve then
    perform _wallet_move(d.user_id, d.amount, 'DEPOSIT', d.id::text, p_note, auth.uid());
  end if;
  update wallet_deposits set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
    note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), case when p_approve then 'DEPOSIT_APPROVED' else 'DEPOSIT_REJECTED' end, 'wallet_deposit', p_id::text,
            jsonb_build_object('user', d.user_id, 'amount', d.amount));
end $$;
revoke execute on function public.admin_review_deposit(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_deposit(uuid,boolean,text) to authenticated;

-- Koreksi saldo manual (tambah/kurangi). Wajib alasan. Hanya ADMIN ke atas.
create or replace function public.admin_adjust_wallet(p_user uuid, p_amount bigint, p_note text)
returns bigint language plpgsql security definer set search_path=public as $$
declare v bigint;
begin
  if not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  if p_amount = 0 or abs(p_amount) > 10000000 then raise exception 'AMOUNT_INVALID'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  v := _wallet_move(p_user, p_amount, 'ADJUST', null, p_note, auth.uid());
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'WALLET_ADJUST', 'wallet', p_user::text, jsonb_build_object('amount', p_amount, 'note', p_note));
  return v;
end $$;
revoke execute on function public.admin_adjust_wallet(uuid,bigint,text) from public, anon;
grant execute on function public.admin_adjust_wallet(uuid,bigint,text) to authenticated;

-- Daftar saldo pelanggan untuk admin.
create or replace function public.admin_wallets() returns table(user_id uuid, email text, full_name text, balance bigint)
language plpgsql stable security definer set search_path=public, auth as $$
begin
  if not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name','')::text, coalesce(w.balance, 0)
    from auth.users u left join wallets w on w.user_id = u.id
    where not exists (select 1 from user_roles r where r.user_id = u.id)
    order by coalesce(w.balance, 0) desc, u.created_at desc;
end $$;
revoke execute on function public.admin_wallets() from public, anon;
grant execute on function public.admin_wallets() to authenticated;

-- Pembeli membayar pesanannya sendiri dengan saldo. Atomik: saldo berkurang dan pesanan jadi PAID dalam satu transaksi.
create or replace function public.pay_order_with_wallet(p_order_number text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  select * into o from orders where order_number = p_order_number and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_status <> 'UNPAID' or o.order_status = 'CANCELLED' then raise exception 'INVALID_TRANSITION'; end if;
  perform _wallet_move(auth.uid(), -o.grand_total, 'PURCHASE', o.order_number, null, auth.uid());
  update orders set payment_status = 'PAID', payment_method = 'WALLET' where id = o.id;
  insert into payment_records(order_id, method, amount, status, verified_by, verified_at, notes)
    values (o.id, 'WALLET', o.grand_total, 'PAID', auth.uid(), now(), 'Dibayar dengan saldo');
  insert into order_status_history(order_id, kind, previous_status, new_status, actor_id, note)
    values (o.id, 'payment', 'UNPAID', 'PAID', auth.uid(), 'Dibayar dengan saldo member');
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'ORDER_PAID_WALLET', 'order', o.id::text, jsonb_build_object('amount', o.grand_total));
end $$;
revoke execute on function public.pay_order_with_wallet(text) from public, anon;
grant execute on function public.pay_order_with_wallet(text) to authenticated;

-- Refund pesanan. Jika pesanan dibayar dengan saldo, uangnya kembali ke saldo pembeli (hanya ADMIN ke atas).
create or replace function public.admin_refund_order(p_order uuid, p_note text)
returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;
begin
  select * into o from orders where id = p_order;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.payment_method = 'WALLET' and not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  perform admin_transition(p_order, 'payment', 'REFUNDED', p_note);
  if o.payment_method = 'WALLET' and o.user_id is not null then
    perform _wallet_move(o.user_id, o.grand_total, 'REFUND', o.order_number, p_note, auth.uid());
  end if;
end $$;
revoke execute on function public.admin_refund_order(uuid,text) from public, anon;
grant execute on function public.admin_refund_order(uuid,text) to authenticated;
