-- 홈 배너의 '토스포인트 100원을 다 받았어요'를 지급 당일에만 남기기 위해
-- 마지막 지급 시각을 상태에 함께 돌려준다. 언제까지 보여줄지는 화면이 정한다.
--
-- 반환 모양이 바뀌어서 create or replace로는 못 고친다 (Postgres가 반환 타입 변경을 막는다).
drop function if exists public.my_promotion_status();

create function public.my_promotion_status()
returns table (
  total integer,
  granted integer,
  plays integer,
  done smallint[],
  ended boolean,
  last_granted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_key text;
  v_since timestamptz;
begin
  select t.anon_key into v_anon_key
  from toss_anon_keys t
  where t.user_id = auth.uid()
  order by t.updated_at desc
  limit 1;

  select g.granted_at into v_since
  from promotion_grants g
  where g.anon_key = v_anon_key and g.stage = 1;

  return query
  select
    (select sum(p.amount)::integer from promotion_stages() p),
    coalesce(
      (select sum(g.amount)::integer from promotion_grants g where g.anon_key = v_anon_key),
      0
    ),
    case
      when v_since is null then 0
      else (
        select count(*)::integer from scores s
        where s.user_id = auth.uid() and s.created_at >= v_since
      )
    end,
    coalesce(
      (select array_agg(g.stage order by g.stage) from promotion_grants g
        where g.anon_key = v_anon_key),
      '{}'::smallint[]
    ),
    promotion_ended(),
    (select max(g.granted_at) from promotion_grants g where g.anon_key = v_anon_key);
end;
$$;

revoke all on function public.my_promotion_status() from public;
grant execute on function public.my_promotion_status() to authenticated;
