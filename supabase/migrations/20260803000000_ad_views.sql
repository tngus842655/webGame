-- 리워드 광고 호출 기록 (DESIGN.md 6장 관리자)
-- AdMob 콘솔은 광고 단위 하나로 묶여 있어 게임별·자리별로 쪼갤 수 없다.
-- 여기서 세는 값의 쓸모는 그 분해와 '눌렀는데 광고가 안 떴다'를 보는 데 있다.
-- 여러 번 실행해도 안전하도록 작성 (기존 객체는 정리 후 재생성)

create table if not exists public.ad_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  -- 게임 안 어느 버튼인지 (<slug>-<동작>, 예: omok-undo)
  placement text not null,
  --   viewed      끝까지 봤다
  --   dismissed   중간에 닫았다 (보상 없음)
  --   unavailable 띄우지 못했다 (재고 없음·상한·에러 — 보상은 준다)
  outcome text not null check (outcome in ('viewed', 'dismissed', 'unavailable')),
  created_at timestamptz not null default now()
);

create index if not exists ad_views_stats_idx
  on public.ad_views (created_at desc);

alter table public.ad_views enable row level security;

-- 조회는 관리자만. play_sessions는 홈 정렬에 필요해 전체 공개지만 이쪽은 그럴 이유가 없다.
drop policy if exists "ad_views_select_admin" on public.ad_views;
create policy "ad_views_select_admin" on public.ad_views
  for select using (public.is_admin());

drop policy if exists "ad_views_insert_own" on public.ad_views;
create policy "ad_views_insert_own" on public.ad_views
  for insert with check (auth.uid() = user_id);
-- update/delete 정책 없음 = 금지

-- 과도한 기록 방지: 동일 유저 분당 10회 (실제 광고는 한 편에 15~30초라 넉넉한 상한)
create or replace function public.check_ad_view_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.ad_views
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception 'ad views too frequent';
  end if;
  return new;
end;
$$;

drop trigger if exists ad_views_rate_limit on public.ad_views;
create trigger ad_views_rate_limit
  before insert on public.ad_views
  for each row execute function public.check_ad_view_rate_limit();

-- 통계 화면용: (게임, 자리) 한 쌍을 한 줄로. 게임 단위 합계는 화면에서 묶는다.
create or replace function public.get_ad_stats(p_days int default 7)
returns table (
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
  select v.game_slug as slug,
         v.placement as spot,
         count(*) filter (where v.outcome = 'viewed') as n_viewed,
         count(*) filter (where v.outcome = 'dismissed') as n_dismissed,
         count(*) filter (where v.outcome = 'unavailable') as n_unavailable
  from public.ad_views v
  where v.created_at >= now() - make_interval(days => greatest(1, least(365, p_days)))
  group by v.game_slug, v.placement
  order by count(*) desc, slug, spot;
end;
$$;
