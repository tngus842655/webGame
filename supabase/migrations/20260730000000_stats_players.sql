-- 전체 이용자 수 (DESIGN.md 5장 관리자)
-- 통계 화면 요약의 '이용자'는 게임별 인원 중 최댓값을 쓰고 있었다. 게임별 인원은
-- 서로 겹치므로 더할 수도 없고, 최댓값은 실제보다 작게 나온다 — 서로 다른 게임을
-- 한 사람이 셋이면 3이 아니라 1로 보였다. 구간 전체의 distinct를 따로 센다.
create or replace function public.get_total_players(p_days int default 7)
returns bigint
language plpgsql
stable
set search_path = public
as $$
declare
  total bigint;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(distinct s.user_id) into total
  from public.play_sessions s
  where s.created_at >= now() - make_interval(days => greatest(1, least(365, p_days)));

  return coalesce(total, 0);
end;
$$;
