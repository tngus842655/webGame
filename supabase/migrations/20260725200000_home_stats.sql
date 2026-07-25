-- 홈 화면용 집계 함수 2종

-- 내 게임별 최고점 + 전체 순위 (로그인한 유저 기준)
create or replace function public.get_my_stats()
returns table (game_slug text, best_score int, rank bigint)
language sql
stable
set search_path = public
as $$
  with bests as (
    select s.game_slug, s.user_id, max(s.score) as best_score
    from public.scores s
    group by s.game_slug, s.user_id
  ),
  ranked as (
    select b.game_slug, b.user_id, b.best_score,
           rank() over (partition by b.game_slug order by b.best_score desc) as rank
    from bests b
  )
  select r.game_slug, r.best_score, r.rank
  from ranked r
  where r.user_id = auth.uid();
$$;

-- 게임별 인기도: 최근 7일 점수 제출 수(= 플레이 판 수)
create or replace function public.get_game_popularity()
returns table (game_slug text, plays bigint)
language sql
stable
set search_path = public
as $$
  select s.game_slug, count(*) as plays
  from public.scores s
  where s.created_at >= now() - interval '7 days'
  group by s.game_slug
  order by plays desc;
$$;
