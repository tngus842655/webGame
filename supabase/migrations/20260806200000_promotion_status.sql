-- 프로모션 안내 화면이 읽는 내 진행 상황.
--
-- 총액과 단계는 promotion_stages()에서 가져온다 — 화면이 금액을 따로 갖고 있으면
-- 지급 로직과 어긋날 수 있다.
create or replace function public.my_promotion_status()
returns table (total integer, granted integer, plays integer, done smallint[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_key text;
begin
  select t.anon_key into v_anon_key
  from toss_anon_keys t
  where t.user_id = auth.uid()
  order by t.updated_at desc
  limit 1;

  return query
  select
    (select sum(p.amount)::integer from promotion_stages() p),
    coalesce(
      (select sum(g.amount)::integer from promotion_grants g where g.anon_key = v_anon_key),
      0
    ),
    (select count(*)::integer from scores s where s.user_id = auth.uid()),
    coalesce(
      (select array_agg(g.stage order by g.stage) from promotion_grants g
        where g.anon_key = v_anon_key),
      '{}'::smallint[]
    );
end;
$$;

revoke all on function public.my_promotion_status() from public;
grant execute on function public.my_promotion_status() to authenticated;
