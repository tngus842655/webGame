-- 받은 의견 삭제 — 관리자만 (DESIGN.md 5장 '의견 보내기')
-- 처리가 끝났거나 도배로 들어온 글을 관리자 화면에서 지울 수 있게 한다.
-- 되돌리는 길은 두지 않았다. 게임 휴지통과 달리 지운 의견을 되살릴 이유가 없다.

drop policy if exists "feedback_delete_admin" on public.feedback;
create policy "feedback_delete_admin" on public.feedback
  for delete using (public.is_admin());
-- update 정책은 여전히 없다 = 금지. 받은 글은 고쳐 쓰는 것이 아니다.
