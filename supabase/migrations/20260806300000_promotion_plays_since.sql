-- 판 수를 접속 보상을 받은 뒤로만 센다.
--
-- 그 전에는 scores 전체를 셌다. 그래서 프로모션 전에 이미 3판 넘게 한 사람은 2·3단계
-- 조건이 처음부터 충족돼 있었고, 게임을 하지 않고 앱을 껐다 켜기만 해도 접속할 때마다
-- 한 단계씩 지급됐다. 실기기 테스트에서 세 번 접속으로 100원이 다 나갔다.
--
-- 기준점은 1단계(접속 보상)를 받은 시각이다. 1단계는 조건이 없고 가장 먼저 나가므로
-- 2·3단계를 따질 때는 항상 존재한다.
create or replace function public.next_promotion_stage()
returns table (stage smallint, amount integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_key text;
  v_since timestamptz;
  v_plays integer;
begin
  select t.anon_key into v_anon_key
  from toss_anon_keys t
  where t.user_id = auth.uid()
  order by t.updated_at desc
  limit 1;
  if v_anon_key is null then
    return;
  end if;

  select g.granted_at into v_since
  from promotion_grants g
  where g.anon_key = v_anon_key and g.stage = 1;

  if v_since is null then
    -- 아직 접속 보상 전이다. 1단계는 조건이 없어 판 수를 볼 것도 없다.
    v_plays := 0;
  else
    select count(*) into v_plays
    from scores s
    where s.user_id = auth.uid() and s.created_at >= v_since;
  end if;

  return query
  select p.stage, p.amount
  from promotion_stages() p
  where v_plays >= p.plays_needed
    and not exists (
      select 1 from promotion_grants g
      where g.anon_key = v_anon_key and g.stage = p.stage
    )
  order by p.stage
  limit 1;
end;
$$;

-- 안내 화면의 '몇 판 남았는지'도 같은 기준을 써야 한다
create or replace function public.my_promotion_status()
returns table (total integer, granted integer, plays integer, done smallint[])
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
    );
end;
$$;
