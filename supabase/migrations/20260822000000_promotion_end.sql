-- 미니게임30 프로모션을 끝낸다.
--
-- 앱인토스 콘솔에서 프로모션(01KZA8PABZ268PXHVSTVAVY7EX, '접속시 20원, 게임 하고
-- 80원더 받아가세요')을 TERMINATED로 내렸다. 비가역이다 — 다시 하려면 프로모션을
-- 새로 만들어 검토를 처음부터 다시 받아야 한다.
--
-- 새 번들은 지급을 아예 시도하지 않지만(.env.toss의 프로모션 코드를 비웠다), 이미
-- 설치된 번들은 그대로 남는다. 그쪽은 접속·게임오버마다 지급을 두드리고, 홈 배너에는
-- '80원 더 받을 수 있어요'가 계속 뜬다 — 시키는 대로 게임을 해도 아무것도 들어오지
-- 않는다. 새 번들이 검토를 통과할 때까지 그 상태로 둘 수 없어서, 20260806700000이
-- 남겨 둔 스위치를 그 용법대로 쓴다.
--
--   - next_promotion_stage()가 빈 값을 돌려 SDK 호출이 멈춘다
--   - my_promotion_status().ended가 true가 되어 배너·안내가 '끝났어요'로 바뀐다
--
-- 이미 꺼져 있으면 그때 시각을 그대로 둔다 (여러 번 돌려도 안전하다).
update public.promotion_state
  set ended_at = coalesce(ended_at, now()),
      ended_code = coalesce(ended_code, '콘솔 종료(TERMINATED)');
