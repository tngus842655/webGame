-- 앱인토스 프로모션 지급 이력.
--
-- 계정(auth.users)이 아니라 토스 식별키에 묶는다. 계정에 걸면 탈퇴 후 다시 들어와
-- 또 받을 수 있다 — delete_my_account()가 auth.users를 지우면 cascade로 이력까지
-- 사라지기 때문이다. 식별키는 토스가 주는 값이라 탈퇴와 무관하게 같다.
create table if not exists public.promotion_grants (
  anon_key text not null,
  stage smallint not null,
  amount integer not null,
  reward_key text,
  granted_at timestamptz not null default now(),
  primary key (anon_key, stage)
);

-- 정책을 두지 않아 클라이언트 권한으로는 읽지도 쓰지도 못한다. 아래 함수로만 다룬다.
alter table public.promotion_grants enable row level security;

-- 단계 정의는 여기 한 곳에만 둔다.
--   1: 접속        20원
--   2: 1판 마치기  30원
--   3: 누적 3판    50원
-- 판 수는 scores 표를 센다 — 게임오버마다 한 줄씩 쌓이므로 그게 곧 판 수다.
create or replace function public.promotion_stages()
returns table (stage smallint, amount integer, plays_needed integer)
language sql
immutable
as $$
  select *
  from (values (1::smallint, 20, 0), (2::smallint, 30, 1), (3::smallint, 50, 3))
    as s(stage, amount, plays_needed);
$$;

-- 지금 이 사람이 받을 수 있는 단계 하나를 돌려준다. 없으면 빈 결과.
--
-- 금액과 조건을 서버가 정한다 — 클라이언트가 금액을 넘기게 하면 얼마든지 바꿔 부를 수 있다.
-- 식별키도 받지 않는다. 받으면 남의 키로 부를 수 있어서, auth.uid()로 서버가 찾는다.
create or replace function public.next_promotion_stage()
returns table (stage smallint, amount integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_key text;
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

  select count(*) into v_plays from scores s where s.user_id = auth.uid();

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

-- 포인트 지급에 성공한 뒤에만 부른다.
--
-- 지급이 먼저이고 기록이 나중이라, 그 사이에 연결이 끊기면 같은 단계를 한 번 더 받을 수
-- 있다. 창이 짧고 콘솔의 '1인 하루 최대 100원'이 백스톱이라 이 순서를 택했다 — 반대로
-- 기록을 먼저 하면, 토스앱 버전이 낮아 지급이 실패한 사람이 업데이트한 뒤에도 영영
-- 못 받게 된다.
create or replace function public.record_promotion_grant(p_stage smallint, p_reward_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anon_key text;
  v_amount integer;
begin
  select t.anon_key into v_anon_key
  from toss_anon_keys t
  where t.user_id = auth.uid()
  order by t.updated_at desc
  limit 1;
  if v_anon_key is null then
    return;
  end if;

  -- 금액도 서버가 다시 정한다 (클라이언트가 보낸 값을 그대로 적지 않는다)
  select p.amount into v_amount from promotion_stages() p where p.stage = p_stage;
  if v_amount is null then
    return;
  end if;

  insert into promotion_grants (anon_key, stage, amount, reward_key)
  values (v_anon_key, p_stage, v_amount, p_reward_key)
  on conflict (anon_key, stage) do nothing;
end;
$$;

revoke all on function public.next_promotion_stage() from public;
revoke all on function public.record_promotion_grant(smallint, text) from public;
grant execute on function public.next_promotion_stage() to authenticated;
grant execute on function public.record_promotion_grant(smallint, text) to authenticated;
