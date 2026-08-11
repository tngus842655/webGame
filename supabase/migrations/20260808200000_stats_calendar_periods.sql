-- 관리자 통계의 기간을 달력으로 자른다 (/stats, /stats/players, /stats/ads)
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.
--
-- 지금까지는 롤링이었다. '최근 1일'은 어제 이 시각부터라, 아침에 본 값과 저녁에 본 값이
-- 서로 다른 구간을 말했고 '어제 하루'는 아예 볼 수 없었다. 인기도 화면(/admin/votes)은
-- 이미 달력으로 자르고 있어, 같은 날 두 화면을 열면 '이번주'가 서로 다른 구간이었다.
--
-- 구간은 화면이 정해 절대 시각으로 보낸다. 보는 사람의 시간대로 계산한 자정이 그대로
-- timestamptz로 실려 오므로 서버는 시간대를 따로 알 필요가 없다.
-- p_from은 구간에 들고 p_to는 들지 않는다(끝날 다음 자정). 둘 다 null이면 전체 누적.
--
-- 인자가 바뀌었으므로 옛 (int) 함수는 따로 지운다 — 이름이 같아도 인자가 다르면 별개
-- 함수라, 그냥 두면 둘 다 남아 PostgREST가 어느 쪽을 부를지 헷갈린다. 새 함수 쪽은
-- create or replace라 두 번째 실행에서도 그대로 덮어쓴다(맨 create면 42723으로 죽는다).

-- ── 게임별 지표 ─────────────────────────────────────────────
drop function if exists public.get_game_stats(int);
create or replace function public.get_game_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  game_slug text,
  plays bigint,
  total_seconds bigint,
  avg_seconds numeric,
  players bigint,
  best_score int
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
  with sessions as (
    select s.game_slug,
           count(*) as plays,
           sum(s.duration_sec)::bigint as total_seconds,
           round(avg(s.duration_sec)::numeric, 1) as avg_seconds,
           count(distinct s.user_id) as players
    from public.play_sessions s
    where (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at < p_to)
    group by s.game_slug
  ),
  tops as (
    select sc.game_slug, max(sc.score) as best_score
    from public.scores sc
    where (p_from is null or sc.created_at >= p_from)
      and (p_to is null or sc.created_at < p_to)
    group by sc.game_slug
  )
  select
    coalesce(sessions.game_slug, tops.game_slug) as game_slug,
    coalesce(sessions.plays, 0) as plays,
    coalesce(sessions.total_seconds, 0) as total_seconds,
    coalesce(sessions.avg_seconds, 0) as avg_seconds,
    coalesce(sessions.players, 0) as players,
    coalesce(tops.best_score, 0)::int as best_score
  from sessions
  full outer join tops on tops.game_slug = sessions.game_slug
  order by total_seconds desc;
end;
$$;

-- ── 구간 전체의 이용자 수 ───────────────────────────────────
-- 게임별 인원은 서로 겹쳐서 더할 수도 최댓값을 쓸 수도 없다 — 따로 센다
drop function if exists public.get_total_players(int);
create or replace function public.get_total_players(
  p_from timestamptz default null,
  p_to timestamptz default null
)
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
  where (p_from is null or s.created_at >= p_from)
    and (p_to is null or s.created_at < p_to);

  return coalesce(total, 0);
end;
$$;

-- ── 이용자별 게임 이용 현황 ─────────────────────────────────
drop function if exists public.get_player_stats(int);
create or replace function public.get_player_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  user_id uuid,
  nickname text,
  game_slug text,
  plays bigint,
  total_seconds bigint,
  last_played_at timestamptz
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
  with pairs as (
    -- 반환 컬럼과 이름이 겹치면 plpgsql이 어느 쪽인지 몰라 막히므로 별칭을 달아 둔다
    select s.user_id as uid,
           s.game_slug as slug,
           count(*) as cnt,
           sum(s.duration_sec)::bigint as secs,
           max(s.created_at) as last_at
    from public.play_sessions s
    where (p_from is null or s.created_at >= p_from)
      and (p_to is null or s.created_at < p_to)
    group by s.user_id, s.game_slug
  ),
  -- 사람이 늘어도 한 화면에 실을 만큼만 — 오래 논 순서로 자른다 (화면의 PLAYER_LIMIT와 같은 값)
  top_players as (
    select p.uid, sum(p.secs) as player_secs
    from pairs p
    group by p.uid
    order by player_secs desc
    limit 100
  )
  select p.uid, pr.nickname, p.slug, p.cnt, p.secs, p.last_at
  from pairs p
  join top_players tp on tp.uid = p.uid
  join public.profiles pr on pr.id = p.uid
  -- 오래 논 사람부터, 그 사람 안에서는 오래 한 게임부터.
  -- uid를 사이에 끼워 시간이 같은 두 사람의 줄이 섞이지 않게 한다.
  order by tp.player_secs desc, p.uid, p.secs desc;
end;
$$;

-- ── 리워드 광고 호출 현황 ───────────────────────────────────
drop function if exists public.get_ad_stats(int);
create or replace function public.get_ad_stats(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  medium text,
  game_slug text,
  placement text,
  viewed bigint,
  dismissed bigint,
  unavailable bigint
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
  select v.medium as src,
         v.game_slug as slug,
         v.placement as spot,
         count(*) filter (where v.outcome = 'viewed') as n_viewed,
         count(*) filter (where v.outcome = 'dismissed') as n_dismissed,
         count(*) filter (where v.outcome = 'unavailable') as n_unavailable
  from public.ad_views v
  where (p_from is null or v.created_at >= p_from)
    and (p_to is null or v.created_at < p_to)
    -- 매체가 없는 행 = 20260807000000 이전에 쌓인 것. 테스트와 실제가 섞여 있고
    -- 갈라낼 단서가 남아 있지 않으므로 세지 않는다 (지우지는 않는다)
    and v.medium is not null
  group by v.medium, v.game_slug, v.placement
  order by count(*) desc, src, slug, spot;
end;
$$;
