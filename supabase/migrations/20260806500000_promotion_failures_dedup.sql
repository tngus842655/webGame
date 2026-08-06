-- 실패 기록이 접속마다 쌓이지 않게 (anon_key, stage, code)로 한 줄만 두고 횟수를 센다.
--
-- 예산이 소진되면(4112) 프로모션이 끝날 때까지 모든 사용자가 접속할 때마다, 게임을
-- 마칠 때마다 거절당한다. 줄마다 새로 넣으면 이 표가 사용자 수 × 접속 횟수만큼 커진다.
-- 이제는 사용자 × 단계 × 사유 로 묶이고, 몇 번이나 튕겼는지는 attempts로 남는다.
--
-- 진단용으로 만든 표라 지금 들어 있는 것은 오늘 테스트에서 나온 기록뿐이다. 그대로 옮길
-- 값이 없어 새로 만든다.
drop table if exists public.promotion_failures;

create table public.promotion_failures (
  -- 식별키를 못 찾은 경우가 한 줄로 모이도록 null 대신 빈 문자열을 쓴다
  anon_key text not null default '',
  stage smallint not null,
  code text not null,
  message text,
  attempts integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (anon_key, stage, code)
);

alter table public.promotion_failures enable row level security;

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
end;
$$;

revoke all on function public.record_promotion_failure(smallint, text, text) from public;
grant execute on function public.record_promotion_failure(smallint, text, text) to authenticated;
