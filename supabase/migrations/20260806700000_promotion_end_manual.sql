-- 프로모션을 끄는 스위치를 클라이언트 손에서 뺀다.
--
-- 바로 앞 마이그레이션(20260806600000)에서 record_promotion_failure()가 거절 코드를 보고
-- promotion_state를 끄게 했다. 그게 구멍이었다.
--
--   - p_code는 클라이언트가 넘기는 문자열이고, 토스 SDK에서 온 값인지 서버가 확인할
--     길이 없다.
--   - 이 앱은 익명 로그인을 쓴다. 번들에 실린 anon key만 있으면 누구나 authenticated가
--     되고, record_promotion_failure()는 authenticated에 열려 있다.
--   - 그래서 아무나 p_code='4112'로 한 번 부르면 전 사용자 지급이 멈춘다.
--
-- 자동 판정이 벌어준 것에 비해 값이 너무 비쌌다. 예산 소진을 스스로 알아채는 것이
-- 목적이었는데, 그건 콘솔에서 잔액으로 보이고 promotion_failures에 4112가 쌓이는 것으로도
-- 드러난다. 반면 잃는 것은 전역 킬스위치다.
--
-- 게다가 자동 판정은 되살아나지 않는 문제도 안고 있었다. 4112(예산 부족)와 4109(일시정지)는
-- 충전하거나 재개하면 풀리는 일시 상태인데, 한 번 박힌 ended_at은 사람이 지우기 전까지
-- 남아서 예산을 채워도 지급이 재개되지 않았다.
--
-- 그래서 끄는 방법을 둘로 정리한다. 둘 다 재배포가 필요 없다.
--
--   1. 예정된 종료 — ends_at. 콘솔 종료일을 넣어두면 그 시각에 저절로 꺼진다.
--   2. 즉시 중단 — ended_at. 예산이 소진됐거나 급히 멈춰야 할 때 사람이 켠다.
--
--        update promotion_state set ended_at = now(), ended_code = '예산 소진';
--
--      되돌릴 때는 무엇으로 꺼졌는지에 따라 지울 것이 다르다. 둘 다 지우면 확실하다.
--
--        update promotion_state set ended_at = null, ended_code = null, ends_at = null;

-- 실패 기록은 다시 기록만 한다 (20260806500000의 그 함수로 되돌린다)
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

-- 앞 마이그레이션이 이미 운영에 적용됐다. 그 사이에 누가 눌렀을 수 있으니 한 번 씻는다.
-- 사람이 끈 적이 없다면 이 표의 ended_at은 비어 있는 것이 맞다.
update public.promotion_state
  set ended_at = null, ended_code = null
  where ended_code in ('4112', '4105', '4109');
