-- 랭킹의 기간을 달력으로 자른다 + 명예의 전당 (지난달 게임별 1~3위)
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.
--
-- 지금까지 랭킹 '주간'은 롤링(지금부터 거꾸로 7일)이었다. 아침에 본 순위와 저녁에
-- 본 순위가 서로 다른 구간을 말했고, '지난주 우승자'라는 개념 자체가 없었다.
-- 통계 화면(20260808200000)이 먼저 달력으로 옮겼고, 랭킹도 같은 방식을 따른다.
--
-- 구간은 화면이 정해 절대 시각으로 보낸다. 랭킹은 모두가 함께 겨루는 한 판이라
-- 보는 사람의 시간대가 아니라 KST 자정으로 고정해 계산해 보낸다(rankPeriod.ts).
-- p_from은 구간에 들고 p_to는 들지 않는다(끝날 다음 자정).
--
-- 인자가 바뀌었으므로 옛 함수는 따로 지운다 — 이름이 같아도 인자가 다르면 별개
-- 함수라, 그냥 두면 둘 다 남아 PostgREST가 어느 쪽을 부를지 헷갈린다.

-- ── 게임별 랭킹 ─────────────────────────────────────────────
-- p_since(시작만) → p_from/p_to(양끝). '이번 주'·'이번 달'이 닫힌 구간이 됐다.
drop function if exists public.get_leaderboard(text, timestamptz, int);
create or replace function public.get_leaderboard(
  p_game_slug text,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50
)
returns table (user_id uuid, nickname text, best_score int, achieved_at timestamptz)
language sql
stable
set search_path = public
as $$
  select t.user_id, t.nickname, t.best_score, t.achieved_at
  from (
    select distinct on (s.user_id)
      s.user_id, p.nickname, s.score as best_score, s.created_at as achieved_at
    from public.scores s
    join public.profiles p on p.id = s.user_id
    where s.game_slug = p_game_slug
      and (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at < p_to)
    order by s.user_id, s.score desc, s.created_at asc
  ) t
  order by t.best_score desc, t.achieved_at asc
  limit least(p_limit, 100);
$$;

-- ── 내 게임별 기록 ──────────────────────────────────────────
-- 홈 카드의 '내 순위'가 이번 달 기준이 되면서 구간 인자가 생겼다.
-- 최고점(best_score)은 구간과 무관하게 전체 누적이다 — 플레이 화면이 이 값을
-- 로컬에 되먹여 신기록 판정에 쓰므로(syncLocalBests), 이게 이번 달 값이 되면
-- 지난달에 1,103점을 낸 사람이 이번 달 400점에 '신기록' 배지를 받는다.
drop function if exists public.get_my_stats();
create or replace function public.get_my_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (game_slug text, best_score int, period_best int, rank bigint)
language sql
stable
set search_path = public
as $$
  with alltime as (
    select s.game_slug, max(s.score) as best_score
    from public.scores s
    where s.user_id = auth.uid()
    group by s.game_slug
  ),
  period_bests as (
    select s.game_slug, s.user_id, max(s.score) as best
    from public.scores s
    where (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at < p_to)
    group by s.game_slug, s.user_id
  ),
  ranked as (
    select b.game_slug, b.user_id, b.best,
           rank() over (partition by b.game_slug order by b.best desc) as rnk
    from period_bests b
  )
  -- 구간에 기록이 없는 게임은 period_best·rank가 null로 나간다 (전체 최고만 남는다)
  select a.game_slug, a.best_score, r.best as period_best, r.rnk as rank
  from alltime a
  left join ranked r on r.game_slug = a.game_slug and r.user_id = auth.uid();
$$;

-- ── 명예의 전당 ─────────────────────────────────────────────
-- 지난달 게임별 상위권을 한 번에 받는다 (게임마다 따로 부르면 서른 번을 오간다).
-- 순위는 게임별 랭킹과 같은 규칙 — 최고점이 높은 순, 같으면 먼저 낸 사람.
create or replace function public.get_hall_of_fame(
  p_from timestamptz,
  p_to timestamptz,
  p_top int default 3
)
returns table (game_slug text, rank int, user_id uuid, nickname text, best_score int)
language sql
stable
set search_path = public
as $$
  with per_user as (
    select distinct on (s.game_slug, s.user_id)
      s.game_slug, s.user_id, s.score as best_score, s.created_at as achieved_at
    from public.scores s
    where s.created_at >= p_from and s.created_at < p_to
    order by s.game_slug, s.user_id, s.score desc, s.created_at asc
  ),
  ranked as (
    select u.*,
           row_number() over (
             partition by u.game_slug order by u.best_score desc, u.achieved_at asc
           ) as rn
    from per_user u
  )
  select r.game_slug, r.rn::int as rank, r.user_id, p.nickname, r.best_score
  from ranked r
  join public.profiles p on p.id = r.user_id
  where r.rn <= least(p_top, 10)
  order by r.game_slug, r.rn;
$$;
