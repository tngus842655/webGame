-- 게임별 좋아요/싫어요 — 게임 화면 오른쪽 위에서 하루에 한 표씩.
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.

create table if not exists public.game_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  -- 기기 시간대 기준 날짜를 클라이언트가 보낸다. 서버 now()로 잡으면 자정 언저리에
  -- 화면이 말하는 '오늘'과 저장되는 날짜가 갈린다 (데일리·스트릭도 같은 기준이다).
  vote_day date not null,
  -- 1 = 좋아요, -1 = 싫어요. 한 칸뿐이라 둘 다 켜진 상태가 아예 만들어지지 않는다
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  -- '한 사람이 한 게임에 하루 한 표'를 여기서 지킨다.
  -- 마음을 바꾸면 새 줄이 아니라 이 줄을 덮어쓴다 (취소는 줄을 지운다).
  primary key (user_id, game_slug, vote_day)
);

create index if not exists game_votes_recent_idx on public.game_votes (vote_day desc);

alter table public.game_votes enable row level security;

-- 쓰는 것은 자기 표만, 읽는 것은 관리자만. 남의 표가 서로 보이면 그때부터 표 수를
-- 두고 다투는 화면이 된다 — 여기서 하려는 일이 아니다.
drop policy if exists "game_votes_insert_own" on public.game_votes;
create policy "game_votes_insert_own" on public.game_votes
  for insert with check (auth.uid() = user_id);

-- 좋아요 → 싫어요로 바꾸면 upsert가 같은 줄을 갱신한다
drop policy if exists "game_votes_update_own" on public.game_votes;
create policy "game_votes_update_own" on public.game_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "game_votes_delete_own" on public.game_votes;
create policy "game_votes_delete_own" on public.game_votes
  for delete using (auth.uid() = user_id);

drop policy if exists "game_votes_select_admin" on public.game_votes;
create policy "game_votes_select_admin" on public.game_votes
  for select using (public.is_admin());

-- 날짜를 클라이언트가 보내므로 '하루 한 표'가 남의 날짜로 부풀 수 있다.
-- 앞뒤로 하루씩 열어 두는 것은 시간대 때문이다 (서버는 UTC, 기기는 제각각이라
-- 같은 순간에도 날짜가 하루 어긋난다). check 제약에는 current_date를 쓸 수 없어서
-- (immutable이 아니다) 트리거로 본다.
create or replace function public.check_game_vote_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vote_day < current_date - 1 or new.vote_day > current_date + 1 then
    raise exception 'vote day out of range';
  end if;
  return new;
end;
$$;

drop trigger if exists game_votes_day_range on public.game_votes;
create trigger game_votes_day_range
  before insert or update on public.game_votes
  for each row execute function public.check_game_vote_day();
