-- 토스 로그인: 앱인토스 미니앱 전용 계정 연동.
-- 앱인토스는 미니앱 안에서 구글·카카오 같은 외부 로그인을 금지한다
-- (toss-docs/login-intro.md "미니앱에서 로그인 기능은 토스 로그인만 사용할 수 있어요").
--
-- Supabase Auth에는 토스 provider가 없어 linkIdentity를 쓸 수 없다. 그래서
-- 토스가 주는 userKey와 auth.users를 이 표로 직접 잇는다.
--
-- 연동은 '지금 쓰던 익명 계정에 userKey를 붙이는' 방식이라 user_id가 그대로다.
-- 구글·카카오의 linkIdentity와 같은 의미이고, 점수·랭킹이 그대로 유지된다.
-- 다른 기기에서 로그인하면 userKey로 그 계정을 찾아 세션을 새로 발급한다.
--
-- userKey는 앱 단위 식별자다 — 같은 사람이라도 미니앱이 다르면 값이 달라진다.
-- 그래서 웹·안드로이드 빌드의 구글/카카오 계정과는 이어지지 않는다.
--
-- 이 표는 서버(api/toss-login.ts)가 service_role로만 다룬다.
-- RLS를 켜고 정책을 두지 않아 클라이언트 권한으로는 읽지도 쓰지도 못한다.
create table if not exists public.toss_accounts (
  user_key bigint primary key,
  user_id uuid not null unique references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.toss_accounts enable row level security;
