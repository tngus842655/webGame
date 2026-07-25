-- M3: profiles / scores 테이블 + RLS + 랭킹 함수 (DESIGN.md 6장)
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다.

-- 1. profiles: auth.users 1:1
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null default '게스트',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 가입(익명 포함) 시 프로필 자동 생성: insert는 이 트리거만 수행한다
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, '게스트-' || substr(md5(random()::text), 1, 4));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. scores: append-only 플레이 기록
create table public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  score int not null check (score >= 0 and score <= 1000000),
  created_at timestamptz not null default now()
);

create index scores_leaderboard_idx on public.scores (game_slug, created_at desc, score desc);

alter table public.scores enable row level security;

create policy "scores_select_all" on public.scores
  for select using (true);

create policy "scores_insert_own" on public.scores
  for insert with check (auth.uid() = user_id);
-- update/delete 정책 없음 = 금지

-- 비정상 제출 빈도 제한: 동일 유저 분당 6회
create or replace function public.check_score_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.scores
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 6 then
    raise exception 'score submissions too frequent';
  end if;
  return new;
end;
$$;

create trigger scores_rate_limit
  before insert on public.scores
  for each row execute function public.check_score_rate_limit();

-- 3. 랭킹 조회: 유저별 최고점 1건씩, 기간 필터 지원
create or replace function public.get_leaderboard(
  p_game_slug text,
  p_since timestamptz default null,
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
      and (p_since is null or s.created_at >= p_since)
    order by s.user_id, s.score desc, s.created_at asc
  ) t
  order by t.best_score desc, t.achieved_at asc
  limit least(p_limit, 100);
$$;
