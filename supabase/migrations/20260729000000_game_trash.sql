-- 게임 휴지통 (DESIGN.md 5장 관리자)
-- 인기 상위 30위 밖으로 밀린 게임을 바로 지우지 않고 일정 기간 보관한다.
-- 보관 중에는 홈·랭킹 목록에서 빠지고, 기간이 지나면 코드에서 제거한다.
alter table public.game_flags
  add column if not exists trashed_at timestamptz;

comment on column public.game_flags.trashed_at is
  '휴지통에 넣은 시각. null이면 정상. 실제 삭제(코드 제거)는 관리자가 수동으로 한다.';
