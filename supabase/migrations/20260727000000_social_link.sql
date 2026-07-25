-- M5: 소셜 연동 지원 — 닉네임을 유저가 직접 정했는지 표시한다.
-- false인 동안에는 구글/카카오 연동 시 소셜 닉네임으로 자동 설정한다.
-- 이미 닉네임을 바꿔둔 기존 유저는 덮어쓰지 않도록 true로 채운다.
--
-- 대시보드 설정도 함께 필요하다 (SQL로는 처리되지 않는 부분):
--   Authentication → Providers → Google, Kakao 활성화 (각 콘솔의 client id/secret 입력)
--   Authentication → URL Configuration → Redirect URLs에 배포 주소 + /settings 등록
--   Authentication → Providers → Manual Linking 활성화 (linkIdentity 사용)
alter table public.profiles
  add column if not exists nickname_set boolean not null default false;

update public.profiles
  set nickname_set = true
  where nickname_set = false and nickname !~ '^게스트(-[0-9a-f]{4})?$';
