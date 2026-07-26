-- 관리자 권한 + 게임 노출 제어 (DESIGN.md 6장)
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다.

-- ── 1. 관리자 판별 ──────────────────────────────────────────
-- 이메일로 판별한다. 관리자는 반드시 소셜 로그인(구글 권장)으로 접속해야 하며,
-- 익명 계정에는 이메일이 없어 절대 관리자가 될 수 없다.
create table if not exists public.admin_emails (
  email text primary key,
  memo text,
  created_at timestamptz not null default now()
);

-- RLS를 켜되 정책을 하나도 만들지 않는다.
-- → 클라이언트에서는 읽기·쓰기 모두 불가능하다. 관리자 추가는 대시보드에서 직접 한다.
-- → 아래 is_admin()은 security definer라 RLS를 우회해 조회한다.
alter table public.admin_emails enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce(auth.jwt() ->> 'email', '') <> ''
  )
$$;

-- ── 2. 게임 노출 제어 ───────────────────────────────────────
-- 신규 게임을 인기 순위와 무관하게 상단에 고정하기 위한 표.
-- 행이 없는 게임은 기본값(고정 아님)으로 본다.
create table if not exists public.game_flags (
  slug text primary key,
  featured boolean not null default false, -- 상단 고정
  hidden boolean not null default false,   -- 목록에서 감춤 (문제 생긴 게임 임시 차단)
  sort_order int not null default 0,       -- 고정된 것끼리의 순서 (작을수록 앞)
  updated_at timestamptz not null default now()
);

alter table public.game_flags enable row level security;

-- 홈 화면 정렬에 필요하므로 조회는 전체 공개
drop policy if exists "game_flags_select_all" on public.game_flags;
create policy "game_flags_select_all" on public.game_flags
  for select using (true);

-- 쓰기는 관리자만
drop policy if exists "game_flags_admin_write" on public.game_flags;
create policy "game_flags_admin_write" on public.game_flags
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 3. 통계는 관리자만 ──────────────────────────────────────
-- 화면을 숨기는 것만으로는 API 직접 호출을 막지 못하므로 함수에서 직접 막는다.
-- get_game_popularity()는 홈 정렬에 쓰이므로 공개로 남겨둔다.
drop function if exists public.get_game_stats(int);
create function public.get_game_stats(p_days int default 7)
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
    coalesce(tops.best_score, 0)::int as best_score
  from sessions
  full outer join tops on tops.game_slug = sessions.game_slug
  order by total_seconds desc;
end;
$$;
