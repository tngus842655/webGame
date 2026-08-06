-- 포인트 지급이 거절된 사유를 남긴다.
--
-- 지금까지는 실패를 통째로 삼켜서, 지급이 안 될 때 우리 판정이 막은 것인지 토스가
-- 거절한 것인지 알 수 없었다. 실기기에서는 콘솔 로그도 볼 수 없어 추측만 남는다.
--
-- 운영에서도 쓸모가 있다 — 예산 소진(4112), 하루 한도, 앱 버전 미달이 각각 얼마나
-- 되는지는 여기서만 보인다.
create table if not exists public.promotion_failures (
  id bigint generated always as identity primary key,
  anon_key text,
  stage smallint,
  code text not null,
  message text,
  created_at timestamptz not null default now()
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
  values (v_anon_key, p_stage, p_code, left(p_message, 300));
end;
$$;

revoke all on function public.record_promotion_failure(smallint, text, text) from public;
grant execute on function public.record_promotion_failure(smallint, text, text) to authenticated;
