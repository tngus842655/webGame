-- 좋아요·싫어요가 저장되지 않던 문제 — 자기 표는 자기가 읽을 수 있어야 한다.
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.
--
-- 표를 넣는 요청은 upsert라 INSERT ... ON CONFLICT DO UPDATE로 나가는데, 이 구문은
-- 넣는 줄을 select 정책으로도 한 번 본다(PostgreSQL의 명령별 정책 적용 표).
-- game_votes는 조회가 관리자뿐이라, 관리자가 아닌 사람은 충돌이 없는 첫 표조차
-- 'new row violates row-level security policy'로 막혔다. 웹에서 되던 것은 그 계정이
-- 관리자여서고, 앱인토스(토스·게스트 계정)에서만 '투표를 저장하지 못했어요'가 뜬
-- 이유도 여기에 있다.
--
-- 표를 거두는 delete도 같은 이유로 조용히 0줄을 지우고 있었다 — where가 컬럼을 읽으므로
-- 역시 select 정책을 탄다. 오류가 아니라 '지운 줄 없음'으로 성공해서, 화면에서만
-- 취소되고 서버에는 표가 남았다.
--
-- 정책은 or로 합쳐지므로 관리자 조회(game_votes_select_admin)는 그대로 둔다.
-- 새로 여는 것은 '내 표'뿐이라, 남의 표가 서로 보이지 않는다는 설계는 그대로다.
drop policy if exists "game_votes_select_own" on public.game_votes;
create policy "game_votes_select_own" on public.game_votes
  for select using (auth.uid() = user_id);
