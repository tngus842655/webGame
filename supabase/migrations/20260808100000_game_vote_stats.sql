-- 좋아요·싫어요 집계 — 관리자 인기도 화면(/admin/votes)의 근거.
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.

-- 기간은 vote_day(누른 기기의 시간대 기준 날짜)로 자른다. created_at(UTC)으로 자르면
-- 화면의 '오늘'과 서버의 오늘이 시간대만큼 어긋난다 — 표를 하루 한 번으로 묶는 축이
-- vote_day이므로 집계도 같은 축을 쓴다. 양끝 null이면 전체 누적.
create or replace function public.get_game_vote_stats(
  p_start date default null,
  p_end date default null
)
returns table (
  game_slug text,
  up bigint,
  down bigint
)
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  -- 반환 컬럼과 이름이 겹치면 plpgsql이 어느 쪽인지 몰라 막히므로 별칭을 달아 둔다
  select v.game_slug as slug,
         count(*) filter (where v.vote = 1) as n_up,
         count(*) filter (where v.vote = -1) as n_down
  from public.game_votes v
  where (p_start is null or v.vote_day >= p_start)
    and (p_end is null or v.vote_day <= p_end)
  group by v.game_slug
  order by n_up desc, slug;
end;
$$;
