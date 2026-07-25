-- 플레이 세션 기록 + 플레이 시간 기반 인기도 + 공개 통계

create table public.play_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  -- 어뷰징 방어: 5초 미만은 클라이언트에서 전송하지 않고, 한 세션 상한은 30분
  duration_sec int not null check (duration_sec >= 5 and duration_sec <= 1800),
  created_at timestamptz not null default now()
);

create index play_sessions_stats_idx on public.play_sessions (game_slug, created_at desc);

alter table public.play_sessions enable row level security;

create policy "play_sessions_select_all" on public.play_sessions
  for select using (true);

create policy "play_sessions_insert_own" on public.play_sessions
  for insert with check (auth.uid() = user_id);
-- update/delete 정책 없음 = 금지

-- 과도한 기록 방지: 동일 유저 분당 10회
create or replace function public.check_session_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.play_sessions
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'play sessions too frequent';
  end if;
  return new;
end;
$$;

create trigger play_sessions_rate_limit
  before insert on public.play_sessions
  for each row execute function public.check_session_rate_limit();

-- 인기도 = 최근 7일 총 플레이 시간 × sqrt(고유 이용자 수)
-- 시간만 쓰면 소수 헤비유저에 휘둘리고, 횟수만 쓰면 짧은 게임이 유리해지므로 둘을 결합한다
create or replace function public.get_game_popularity()
returns table (game_slug text, plays bigint, total_seconds bigint, players bigint, score numeric)
language sql
stable
set search_path = public
as $$
  select
    s.game_slug,
    count(*) as plays,
    sum(s.duration_sec)::bigint as total_seconds,
    count(distinct s.user_id) as players,
    (sum(s.duration_sec) * sqrt(count(distinct s.user_id)))::numeric as score
  from public.play_sessions s
  where s.created_at >= now() - interval '7 days'
  group by s.game_slug
  order by score desc;
$$;

-- 통계 페이지용: 기간을 지정해 게임별 지표를 한 번에 조회 (누구나 열람 가능)
create or replace function public.get_game_stats(p_days int default 7)
returns table (
  game_slug text,
  plays bigint,
  total_seconds bigint,
  avg_seconds numeric,
  players bigint,
  best_score int
)
language sql
stable
set search_path = public
as $$
  with span as (
    select now() - make_interval(days => greatest(1, least(365, p_days))) as since
  ),
  sessions as (
    select s.game_slug,
           count(*) as plays,
           sum(s.duration_sec)::bigint as total_seconds,
           round(avg(s.duration_sec)::numeric, 1) as avg_seconds,
           count(distinct s.user_id) as players
    from public.play_sessions s, span
    where s.created_at >= span.since
    group by s.game_slug
  ),
  tops as (
    select sc.game_slug, max(sc.score) as best_score
    from public.scores sc, span
    where sc.created_at >= span.since
    group by sc.game_slug
  )
  select
    coalesce(sessions.game_slug, tops.game_slug) as game_slug,
    coalesce(sessions.plays, 0) as plays,
    coalesce(sessions.total_seconds, 0) as total_seconds,
    coalesce(sessions.avg_seconds, 0) as avg_seconds,
    coalesce(sessions.players, 0) as players,
    coalesce(tops.best_score, 0) as best_score
  from sessions
  full outer join tops on tops.game_slug = sessions.game_slug
  order by total_seconds desc;
$$;
