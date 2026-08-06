-- 프로모션이 끝났다는 것을 앱이 알게 한다.
--
-- 지금까지는 종료를 아는 길이 없었다. 예산이 소진되거나 종료일이 지나도 홈 배너는
-- '80원 더 받을 수 있어요'를, 안내 화면은 '조건을 채우면 바로 지급됩니다'를 계속
-- 띄웠다. 시키는 대로 게임을 해도 아무것도 들어오지 않는다 — 토스 문서가 경고하는
-- "유저가 종료 사실을 인지하지 못하는" 상황이 그대로 만들어져 있었다.
--
-- 끄는 것은 자동, 되살리는 것은 사람이 한다. 예산 부족(4112)과 일시정지(4109)는
-- 충전하거나 재개하면 풀리는데, 코드 한 번으로 영구 종료를 못 박으면 되살아난 뒤에도
-- 꺼진 채로 남는다. 다시 켜려면 아래 한 줄이면 된다.
--
--   update promotion_state set ended_at = null, ended_code = null;

create table if not exists public.promotion_state (
  -- 한 줄만 두는 표. check로 다른 값이 못 들어오게 막아 primary key가 곧 '그 한 줄'이 된다
  id boolean primary key default true check (id),
  -- 콘솔에 등록한 종료일. 아무도 지급을 시도하지 않아도 이 날짜가 지나면 끝난 것으로 본다.
  -- 모르면 비워두고, 정해지면 update로 채운다
  ends_at timestamptz,
  -- 종료를 뜻하는 거절 코드를 처음 받은 시각
  ended_at timestamptz,
  ended_code text
);

insert into public.promotion_state (id) values (true) on conflict (id) do nothing;

-- 정책을 두지 않아 클라이언트 권한으로는 읽지도 쓰지도 못한다. 아래 함수들만 본다.
alter table public.promotion_state enable row level security;

create or replace function public.promotion_ended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ended_at is not null or (ends_at is not null and now() >= ends_at)
     from promotion_state limit 1),
    false
  );
$$;

-- 거절 사유를 남기면서, 그것이 종료를 뜻하는 코드면 프로모션을 끈다.
--
-- 한 사람이 '예산 부족'을 받았다는 것은 나머지 전원도 못 받는다는 뜻이다. 그래서 처음
-- 부딪힌 사람이 모두를 위해 끈다. 종료가 아닌 실패(버전 미달·이미 지급됨·금액 초과·
-- 1인 총액 한도)와는 코드로 갈린다 — 그쪽은 그 사람만의 사정이라 건드리지 않는다.
create or replace function public.record_promotion_failure(
  p_stage smallint,
  p_code text,
  p_message text
)
returns void
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

  insert into promotion_failures (anon_key, stage, code, message)
  values (coalesce(v_anon_key, ''), p_stage, p_code, left(p_message, 300))
  on conflict (anon_key, stage, code) do update
    set attempts = promotion_failures.attempts + 1,
        last_at = now();

  -- 4112 예산 부족 · 4105 종료 · 4109 실행중 아님
  if p_code in ('4112', '4105', '4109') then
    update promotion_state
      set ended_at = now(), ended_code = p_code
      where ended_at is null;
  end if;
end;
$$;

-- 끝난 뒤에는 내줄 단계를 찾지 않는다. 어차피 거절당할 지급을 접속마다, 판마다
-- 두드릴 이유가 없다. 되살리려면 위의 update로 플래그를 지우면 된다.
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
  if promotion_ended() then
    return;
  end if;

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

-- 화면이 종료를 알아야 하므로 ended를 함께 돌려준다. 반환 모양이 바뀌어서
-- create or replace로는 못 고친다 (Postgres가 반환 타입 변경을 막는다).
drop function if exists public.my_promotion_status();

create function public.my_promotion_status()
returns table (total integer, granted integer, plays integer, done smallint[], ended boolean)
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
    promotion_ended();
end;
$$;

revoke all on function public.promotion_ended() from public;
revoke all on function public.next_promotion_stage() from public;
revoke all on function public.my_promotion_status() from public;
grant execute on function public.next_promotion_stage() to authenticated;
grant execute on function public.my_promotion_status() to authenticated;
