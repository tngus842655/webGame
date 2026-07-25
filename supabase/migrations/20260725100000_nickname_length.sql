-- M4: 닉네임 길이 제한 (클라이언트 검증과 동일한 1~12자)
alter table public.profiles
  add constraint profiles_nickname_length check (char_length(nickname) between 1 and 12);
