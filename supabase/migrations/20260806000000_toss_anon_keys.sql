-- 앱인토스 사용자 식별키 — 프로모션 중복 지급을 막을 기준값.
--
-- Supabase 익명 계정(user_id)은 앱 데이터를 지우면 새로 만들어져서 '1인 1회'를 셀 수
-- 없다. 토스가 주는 식별키는 미니앱별로 고유하고 같은 사람에게 항상 같은 값이라
-- (toss-docs/user-hash-key-develop.md) 지우고 다시 들어와도 유지된다.
--
-- 그래서 식별키를 기본키로 두고, 그 사람이 지금 쓰는 계정을 user_id에 붙인다.
-- 앱 데이터를 지우고 돌아오면 같은 행의 user_id만 바뀐다 — created_at과 updated_at이
-- 갈라지는 것으로 키가 유지된다는 사실을 확인할 수 있다.
create table if not exists public.toss_anon_keys (
  anon_key text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 정책을 두지 않아 클라이언트 권한으로는 읽지도 쓰지도 못한다.
-- 쓰기는 아래 함수만 할 수 있고, 조회는 열지 않는다 — 남의 식별키를 훑을 이유가 없다.
alter table public.toss_anon_keys enable row level security;

-- 지금은 클라이언트가 보낸 값을 그대로 믿는다. 확인용 기록이라 이걸로 충분하다.
-- 프로모션 지급을 이 표에 걸 때는 서버가 anon-key/verify API(mTLS)로 검증한 뒤
-- 기록하도록 바꿔야 한다 — 클라이언트는 아무 문자열이나 보낼 수 있다.
create or replace function public.record_toss_anon_key(p_anon_key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.toss_anon_keys (anon_key, user_id)
  values (p_anon_key, auth.uid())
  on conflict (anon_key) do update
    set user_id = auth.uid(), updated_at = now()
    where toss_anon_keys.user_id <> auth.uid();
$$;

revoke all on function public.record_toss_anon_key(text) from public;
grant execute on function public.record_toss_anon_key(text) to authenticated;
