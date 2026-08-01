-- 사용자 의견 접수 — 버그 제보·문의·개선 제안 (DESIGN.md 5장 '의견 보내기')
-- 대시보드 SQL Editor에 그대로 붙여넣어 실행할 수 있다. 여러 번 돌려도 안전하다.

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- bug: 버그 제보 / ask: 문의 / idea: 개선 제안
  kind text not null check (kind in ('bug', 'ask', 'idea')),
  -- 입력칸의 maxlength와 같은 값. 앞뒤 공백만 채워 보내는 것은 막는다
  title text not null check (char_length(btrim(title)) between 1 and 40),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_recent_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- 보내는 것은 누구나(익명 계정 포함), 읽는 것은 관리자만.
-- 남의 글이 서로 보이면 게시판이 되고 신고·차단까지 딸려 온다 — 여기서 하려는 일이 아니다.
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_select_admin" on public.feedback;
create policy "feedback_select_admin" on public.feedback
  for select using (public.is_admin());
-- update/delete 정책 없음 = 금지

-- 도배 방지: 동일 유저 분당 3회 (scores·play_sessions와 같은 방식)
create or replace function public.check_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.feedback
    where user_id = new.user_id and created_at > now() - interval '1 minute'
  ) >= 3 then
    raise exception 'feedback too frequent';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.check_feedback_rate_limit();
