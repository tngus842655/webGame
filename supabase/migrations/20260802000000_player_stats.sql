-- 이용자별 게임 이용 현황 (통계 화면의 '이용자 수' → 상세보기)
-- 요약의 이용자 수는 몇 명인지만 알려줄 뿐 누가 무엇을 얼마나 했는지는 답하지 못한다.
-- (이용자, 게임) 한 쌍을 한 줄로 돌려주고 사람 단위 합계는 화면에서 묶는다 —
-- 사람 목록과 게임 내역을 따로 두 번 조회할 만큼 많은 양이 아니다.
create or replace function public.get_player_stats(p_days int default 7)
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
  with span as (
    select now() - make_interval(days => greatest(1, least(365, p_days))) as since
  ),
  pairs as (
    -- 반환 컬럼과 이름이 겹치면 plpgsql이 어느 쪽인지 몰라 막히므로 별칭을 달아 둔다
    select s.user_id as uid,
           s.game_slug as slug,
           count(*) as cnt,
           sum(s.duration_sec)::bigint as secs,
           max(s.created_at) as last_at
    from public.play_sessions s, span
    where s.created_at >= span.since
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
