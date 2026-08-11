-- 관리자 계정의 점수를 랭킹에서 뺀다.
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.
--
-- 관리자는 게임을 고치면서 같은 판을 수십 번 돌린다. 그 기록이 그대로 랭킹에 올라
-- 1위 자리를 테스트 데이터가 차지했다. 점수 행을 지우는 방식은 쓰지 않는다 —
-- scores에는 delete 정책이 아예 없고(20260725000000), 무엇이 테스트였는지 나중에
-- 가려낼 방법도 없다. 대신 **읽는 쪽에서 뺀다.** 이미 쌓인 기록에도 소급 적용된다.
--
-- 관리자 본인의 최고 기록(get_my_stats의 best_score)은 그대로 남는다. 빠지는 것은
-- 순위(rank·period_best)와 남에게 보이는 표(랭킹·명예의 전당)뿐이다.
--
-- 관리자를 뺀 만큼 다른 사람의 등수는 앞당겨진다 (2위였다면 1위가 된다).

-- ── 1. 관리자 user_id 목록 ──────────────────────────────────
-- admin_emails는 이메일만 갖고 있어 auth.users와 맞춰야 하는데, auth 스키마는
-- 클라이언트가 못 읽으므로 security definer로 감싼다.
--
-- 실행 권한은 회수한다. 이 함수가 알려 주는 것은 "이 uuid가 관리자다"인데,
-- scores·profiles가 공개 조회라(scores_select_all) 그 uuid로 관리자의 프로필을
-- 바로 짚을 수 있다. 아래 랭킹 함수들이 security definer라 소유자 권한으로
-- 부르므로, 바깥에 열어 둘 이유가 없다.
create or replace function public.admin_user_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select u.id
  from auth.users u
  join public.admin_emails a on lower(a.email) = lower(u.email)
$$;

revoke all on function public.admin_user_ids() from public;

-- ── 2. 게임별 랭킹 ─────────────────────────────────────────
-- security definer로 바꾼다. 돌려주는 값은 종전과 같다 — scores·profiles는 원래
-- 공개 조회라 RLS를 우회해도 새로 드러나는 것이 없고, 대신 위 목록을 부를 수 있다.
create or replace function public.get_leaderboard(
  p_game_slug text,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50
)
returns table (user_id uuid, nickname text, best_score int, achieved_at timestamptz)
language sql
security definer
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
      and s.user_id not in (select public.admin_user_ids())
    order by s.user_id, s.score desc, s.created_at asc
  ) t
  order by t.best_score desc, t.achieved_at asc
  limit least(p_limit, 100);
$$;

-- ── 3. 내 게임별 기록 ───────────────────────────────────────
-- 최고점(best_score)은 관리자에게도 그대로 나간다 — 플레이 화면의 신기록 판정이
-- 이 값을 쓰므로(syncLocalBests) 여기서 빼면 관리자는 늘 신기록이 된다.
-- 순위 계산에서만 관리자를 뺀다. 관리자 자신의 rank·period_best는 null이 된다.
create or replace function public.get_my_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (game_slug text, best_score int, period_best int, rank bigint)
language sql
security definer
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
      and s.user_id not in (select public.admin_user_ids())
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

-- ── 4. 명예의 전당 ──────────────────────────────────────────
create or replace function public.get_hall_of_fame(
  p_from timestamptz,
  p_to timestamptz,
  p_top int default 3
)
returns table (game_slug text, rank int, user_id uuid, nickname text, best_score int)
language sql
security definer
stable
set search_path = public
as $$
  with per_user as (
    select distinct on (s.game_slug, s.user_id)
      s.game_slug, s.user_id, s.score as best_score, s.created_at as achieved_at
    from public.scores s
    where s.created_at >= p_from and s.created_at < p_to
      and s.user_id not in (select public.admin_user_ids())
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
