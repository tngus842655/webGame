-- 머지 가든 밸런스 개편(체인 12→8단계, 점수 470/23 → 100/5) 뒤처리.
-- Supabase 대시보드 → SQL Editor에 붙여넣어 실행한다. 앱에서는 못 지운다:
-- scores·play_sessions 둘 다 delete 정책이 없어 RLS가 막는다 (init.sql 'update/delete 정책 없음 = 금지').
--
-- 순서가 중요하다. **새 밸런스를 배포한 뒤에 5번을 실행할 것** — 배포 전에 지우면
-- 그 사이에 들어온 옛 점수가 다시 쌓인다.

-- ── 1. 지금 랭킹 (유저별 최고점 1건, 앱의 '전체' 탭과 같은 계산) ────────────
select
  p.nickname,
  s.score                                          as 최고점,
  s.created_at at time zone 'Asia/Seoul'           as 기록시각
from (
  select distinct on (user_id) user_id, score, created_at
  from public.scores
  where game_slug = 'merge'
  order by user_id, score desc, created_at asc
) s
join public.profiles p on p.id = s.user_id
order by s.score desc
limit 50;

-- ── 2. 기록 규모 한눈에 — 지울지 말지는 이 표를 보고 정한다 ────────────────
-- 개편 후 전판을 완벽하게 깨야 9,105점이다. 여기 최고점이 그보다 높으면
-- 새 기록으로는 영원히 못 넘는다 = 지우는 게 맞다.
select
  count(*)                                         as 제출건수,
  count(distinct user_id)                          as 사람수,
  max(score)                                       as 최고점,
  round(avg(score))                                as 평균,
  min(created_at) at time zone 'Asia/Seoul'        as 첫기록,
  max(created_at) at time zone 'Asia/Seoul'        as 마지막기록
from public.scores
where game_slug = 'merge';

-- ── 3. 최근 플레이 시간 (한 판을 얼마나 붙잡고 있었나) ─────────────────────
-- duration_sec은 5초~30분으로 잘려 들어온다. 개편 전 한 단계가 3.5분이었으니
-- 30분 상한(1800)에 붙은 세션이 많으면 그게 노가다의 증거다.
select
  p.nickname,
  ps.duration_sec                                  as 초,
  round(ps.duration_sec / 60.0, 1)                 as 분,
  ps.created_at at time zone 'Asia/Seoul'          as 플레이시각
from public.play_sessions ps
join public.profiles p on p.id = ps.user_id
where ps.game_slug = 'merge'
order by ps.created_at desc
limit 50;

-- ── 4. 플레이 시간 요약 ────────────────────────────────────────────────────
select
  count(*)                                         as 세션수,
  round(avg(duration_sec))                         as 평균초,
  round(avg(duration_sec) / 60.0, 1)               as 평균분,
  max(duration_sec)                                as 최장초,
  count(*) filter (where duration_sec >= 1800)     as 상한에걸린세션
from public.play_sessions
where game_slug = 'merge';

-- ── 5. 삭제 — 위 표를 확인한 뒤, 새 밸런스를 배포하고 나서 실행할 것 ───────
-- 되돌릴 수 없다. 머지 가든 점수만 지우고 다른 게임은 건드리지 않는다.
-- delete from public.scores where game_slug = 'merge';

-- 플레이 시간까지 지울지는 따로 정한다. 인기도·통계의 근거라 남겨 두면
-- '개편 전에 이만큼 붙잡고 있었다'는 비교 기준이 된다 — 지우지 않기를 권한다.
-- delete from public.play_sessions where game_slug = 'merge';

-- ── 6. 삭제 확인 ───────────────────────────────────────────────────────────
-- select count(*) from public.scores where game_slug = 'merge';   -- 0이어야 한다
