-- 기본 닉네임을 영어로 — '게스트-3f2a' → 'Guest-3f2a'
-- 닉네임은 가입 트리거가 서버에서 짓는다. 그 시점에는 접속자가 어느 언어를 쓰는지
-- 알 수 없어서, 영어권 사용자에게도 한글 이름이 그대로 붙고 있었다. 게다가 이 이름은
-- 랭킹에서 남에게 보이는 값이라 보는 쪽 언어도 제각각이다 — 한 가지로 고정해야 하고,
-- 그렇다면 읽을 수 있는 사람이 가장 많은 쪽이 낫다.

alter table public.profiles alter column nickname set default 'Guest';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'Guest-' || substr(md5(random()::text), 1, 4));
  return new;
end;
$$;

-- 아직 손대지 않은 기본 이름만 바꾼다. 뒤 네 자리는 그대로 두어 같은 사람으로 보이게 한다.
-- nickname_set = true는 직접 정한 이름이라 '게스트-1234'라고 지었더라도 건드리지 않는다.
update public.profiles
  set nickname = 'Guest-' || right(nickname, 4)
  where nickname_set = false and nickname ~ '^게스트-[0-9a-f]{4}$';
