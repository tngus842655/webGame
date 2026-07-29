-- 회원 탈퇴: 본인 계정과 게임 기록을 지운다.
-- profiles → auth.users, scores/play_sessions → profiles 로 on delete cascade가 걸려 있어
-- auth.users 한 줄만 지우면 딸린 기록이 함께 사라진다.
-- auth 스키마는 클라이언트 권한으로 건드릴 수 없으므로 security definer로 감싼다.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception '로그인 상태가 아닙니다';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
