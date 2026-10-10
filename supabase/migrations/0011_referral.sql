-- Program referral: kode per akun, teman mendaftar dengan kode, setelah teman punya N pesanan SELESAI
-- pemilik kode otomatis mendapat kupon diskon sekali pakai. Aman dijalankan ulang.
create table if not exists referral_codes(
  user_id uuid primary key references auth.users on delete cascade,
  code text not null, created_at timestamptz default now());
create unique index if not exists referral_codes_code_uq on referral_codes(upper(code));

create table if not exists referrals(
  referred_user uuid primary key references auth.users on delete cascade,
  referrer_user uuid not null references auth.users on delete cascade,
  code_used text not null, created_at timestamptz default now(),
  rewarded_at timestamptz, coupon_id uuid references coupons on delete set null);
create index if not exists referrals_referrer_idx on referrals(referrer_user);

alter table referral_codes enable row level security;
alter table referrals enable row level security;
revoke all on referral_codes, referrals from anon, authenticated;

create or replace function public.referral_cfg(out req int, out pct int) language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from store_settings where key = 'referral_orders_required'), 3),
         coalesce((select (value #>> '{}')::int from store_settings where key = 'referral_percent'), 10) $$;

create or replace function public._make_ref_code(p_user uuid, p_plain boolean) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_base text; v_code text; i int := 0;
begin
  select upper(regexp_replace(coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1), 'WAH'), '[^A-Za-z0-9]', '', 'g'))
    into v_base from auth.users u where u.id = p_user;
  v_base := left(coalesce(nullif(v_base,''), 'WAH'), 8);
  v_code := v_base;
  if not p_plain then v_code := v_base || lpad((floor(random()*1000))::int::text, 3, '0'); end if;
  while exists (select 1 from referral_codes where upper(code) = v_code and user_id <> p_user) and i < 30 loop
    v_code := v_base || lpad((floor(random()*10000))::int::text, 4, '0'); i := i + 1;
  end loop;
  return v_code;
end $$;

-- Kode saya + statistik + daftar kupon hadiah.
create or replace function public.my_referral() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text; cfg record; v_pending int; v_ok int; v_coupons jsonb;
begin
  if auth.uid() is null then raise exception 'Silakan masuk' using errcode = '42501'; end if;
  select code into v_code from referral_codes where user_id = auth.uid();
  if v_code is null then
    v_code := _make_ref_code(auth.uid(), false);
    insert into referral_codes(user_id, code) values (auth.uid(), v_code) on conflict (user_id) do nothing;
    select code into v_code from referral_codes where user_id = auth.uid();
  end if;
  select * into cfg from referral_cfg();
  select count(*) filter (where rewarded_at is null), count(*) filter (where rewarded_at is not null)
    into v_pending, v_ok from referrals where referrer_user = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'percent', c.discount_value, 'used', c.used_count >= coalesce(c.usage_limit, 1), 'expires_at', c.expires_at) order by r.rewarded_at desc), '[]'::jsonb)
    into v_coupons from referrals r join coupons c on c.id = r.coupon_id where r.referrer_user = auth.uid();
  return jsonb_build_object('code', v_code, 'pending', v_pending, 'success', v_ok, 'coupons', v_coupons, 'required', cfg.req, 'percent', cfg.pct);
end $$;

-- Perbarui kode dari nama akun.
create or replace function public.regen_referral_code() returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Silakan masuk' using errcode = '42501'; end if;
  v_code := _make_ref_code(auth.uid(), true);
  insert into referral_codes(user_id, code) values (auth.uid(), v_code)
    on conflict (user_id) do update set code = excluded.code;
  return v_code;
end $$;

-- Dipanggil akun baru setelah masuk pertama kali dengan kode dari teman.
create or replace function public.apply_referral(p_code text) returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_ref uuid; v_created timestamptz;
begin
  if auth.uid() is null then return false; end if;
  select user_id into v_ref from referral_codes where upper(code) = upper(btrim(p_code));
  if v_ref is null or v_ref = auth.uid() then return false; end if;
  select created_at into v_created from auth.users where id = auth.uid();
  if v_created < now() - interval '7 days' then return false; end if;
  if exists (select 1 from orders where user_id = auth.uid()) then return false; end if;
  insert into referrals(referred_user, referrer_user, code_used) values (auth.uid(), v_ref, upper(btrim(p_code)))
    on conflict (referred_user) do nothing;
  return found;
end $$;

-- Hadiah: saat pesanan teman menjadi SELESAI dan jumlahnya mencapai syarat, buat kupon sekali pakai.
create or replace function public._referral_reward() returns trigger language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; cfg record; v_n int; v_coupon uuid; v_code text;
begin
  if new.order_status <> 'COMPLETED' or old.order_status = 'COMPLETED' or new.user_id is null then return new; end if;
  select * into r from referrals where referred_user = new.user_id and rewarded_at is null for update;
  if not found then return new; end if;
  select * into cfg from referral_cfg();
  select count(*) into v_n from orders where user_id = new.user_id and order_status = 'COMPLETED';
  if v_n < cfg.req then return new; end if;
  v_code := 'REF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into coupons(code, discount_type, discount_value, usage_limit, expires_at)
    values (v_code, 'PERCENT', cfg.pct, 1, now() + interval '90 days') returning id into v_coupon;
  update referrals set rewarded_at = now(), coupon_id = v_coupon where referred_user = r.referred_user;
  return new;
end $$;
drop trigger if exists orders_referral_reward on orders;
create trigger orders_referral_reward after update of order_status on orders for each row execute function public._referral_reward();

revoke execute on function public.my_referral(), public.regen_referral_code(), public.apply_referral(text), public.referral_cfg(), public._make_ref_code(uuid, boolean), public._referral_reward() from public, anon;
grant execute on function public.my_referral(), public.regen_referral_code(), public.apply_referral(text), public.referral_cfg() to authenticated;
