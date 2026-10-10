-- Pratinjau kupon di halaman checkout. Aturannya sama dengan create_order. Aman dijalankan ulang.
create or replace function public.check_coupon(p_code text, p_subtotal bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c coupons%rowtype; v_disc bigint;
begin
  if auth.uid() is null then raise exception 'Silakan masuk' using errcode = '42501'; end if;
  select * into c from coupons where upper(code) = upper(btrim(p_code)) and is_active
    and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'reason', 'INVALID'); end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then return jsonb_build_object('ok', false, 'reason', 'EXHAUSTED'); end if;
  if p_subtotal < c.min_purchase then return jsonb_build_object('ok', false, 'reason', 'MIN_PURCHASE', 'min', c.min_purchase); end if;
  v_disc := case c.discount_type when 'FIXED' then c.discount_value else p_subtotal * c.discount_value / 100 end;
  v_disc := least(v_disc, coalesce(c.max_discount, v_disc), p_subtotal);
  return jsonb_build_object('ok', true, 'discount', v_disc);
end $$;
revoke execute on function public.check_coupon(text, bigint) from public, anon;
grant execute on function public.check_coupon(text, bigint) to authenticated;
