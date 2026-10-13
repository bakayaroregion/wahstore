-- Isi saldo: member membayar (QRIS / transfer manual), lalu kirim bukti ke WhatsApp admin. Admin menambah saldo setelah cek.
-- Bukti tidak lagi diunggah ke website. Aman dijalankan ulang.
alter table wallet_deposits alter column proof_path drop not null;
alter table wallet_deposits drop constraint if exists wallet_deposits_amount_check;
alter table wallet_deposits add constraint wallet_deposits_amount_check check (amount between 1000 and 10000000);

drop function if exists public.request_deposit(bigint, uuid, text);
create or replace function public.request_deposit(p_amount bigint, p_method uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare m payment_methods%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN'; end if;
  if p_amount < 10000 or p_amount > 10000000 then raise exception 'AMOUNT_INVALID'; end if;
  select * into m from payment_methods where id = p_method and is_active;
  if not found then raise exception 'METHOD_INVALID'; end if;
  if (select count(*) from wallet_deposits where user_id = auth.uid() and status = 'PENDING') >= 5 then raise exception 'TOO_MANY_PENDING'; end if;
  insert into wallet_deposits(user_id, user_email, amount, method_label)
    values (auth.uid(), auth.jwt()->>'email', p_amount, m.kind || ' - ' || m.label) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.request_deposit(bigint,uuid) from public, anon;
grant execute on function public.request_deposit(bigint,uuid) to authenticated;

-- Admin setujui dengan nominal yang benar-benar diterima (boleh beda dari pengajuan) atau tolak dengan alasan.
drop function if exists public.admin_review_deposit(uuid, boolean, text);
create or replace function public.admin_review_deposit(p_id uuid, p_approve boolean, p_note text default null, p_amount bigint default null)
returns void language plpgsql security definer set search_path=public as $$
declare d wallet_deposits%rowtype; v_amt bigint;
begin
  if not has_role(array['SUPER_ADMIN','ADMIN']::app_role[]) then raise exception 'FORBIDDEN'; end if;
  select * into d from wallet_deposits where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if d.status <> 'PENDING' then raise exception 'INVALID_TRANSITION'; end if;
  if not p_approve and coalesce(btrim(p_note), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  v_amt := coalesce(p_amount, d.amount);
  if p_approve and (v_amt < 1000 or v_amt > 10000000) then raise exception 'AMOUNT_INVALID'; end if;
  if p_approve then
    perform _wallet_move(d.user_id, v_amt, 'DEPOSIT', d.id::text, p_note, auth.uid());
    update wallet_deposits set amount = v_amt where id = p_id;
  end if;
  update wallet_deposits set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
    note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), case when p_approve then 'DEPOSIT_APPROVED' else 'DEPOSIT_REJECTED' end, 'wallet_deposit', p_id::text,
            jsonb_build_object('user', d.user_id, 'requested', d.amount, 'credited', case when p_approve then v_amt end));
end $$;
revoke execute on function public.admin_review_deposit(uuid,boolean,text,bigint) from public, anon;
grant execute on function public.admin_review_deposit(uuid,boolean,text,bigint) to authenticated;
