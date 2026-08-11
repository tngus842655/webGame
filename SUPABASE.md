# Supabase 현황

운영 DB에 **실제로 적용된 것**을 적어 둔다. `supabase/migrations/`의 SQL 파일은
"쓴 것"이고, 이 문서는 "돌린 것"이다. 둘이 어긋나면 사고가 나므로,
대시보드 SQL Editor에서 실행할 때마다 아래 표를 같이 갱신할 것.

이 프로젝트는 Supabase CLI로 마이그레이션을 밀지 않는다.
파일을 열어 **대시보드 SQL Editor에 붙여넣어 실행**하는 방식이다.

## 적용 현황

| 파일 | 내용 | 적용 |
| --- | --- | --- |
| `20260725000000_init.sql` | `profiles`·`scores` 테이블, RLS, 가입 트리거, 점수 레이트리밋, `get_leaderboard()` | ✅ |
| `20260725100000_nickname_length.sql` | 닉네임 1~12자 제약 | ✅ |
| `20260725200000_home_stats.sql` | `get_my_stats()`, `get_game_popularity()` 최초판 | ✅ |
| `20260726000000_play_sessions.sql` | `play_sessions` 테이블, 세션 레이트리밋, `get_game_popularity()` 재정의 | ✅ |
| `20260727000000_social_link.sql` | `profiles.nickname_set` 컬럼 | ✅ |
| `20260728000000_admin.sql` | `admin_emails`·`game_flags` 테이블, `is_admin()`, `get_game_stats()` | ✅ |
| `20260729000000_game_trash.sql` | `game_flags.trashed_at` 컬럼 | ✅ |
| `20260730000000_stats_players.sql` | `get_total_players()` | ✅ |
| `20260731000000_delete_account.sql` | `delete_my_account()` — 회원 탈퇴 | ✅ 2026-07-29 |
| `20260801000000_feedback.sql` | `feedback` 테이블 — 의견 접수, 분당 3회 제한 | ✅ 2026-08-01 |
| `20260801100000_feedback_delete.sql` | `feedback` 삭제 정책 (관리자만) | ✅ 2026-08-01 |
| `20260802000000_player_stats.sql` | `get_player_stats()` — 이용자별 게임 이용 현황 | ✅ 2026-08-02 |
| `20260803000000_ad_views.sql` | `ad_views` 테이블 — 리워드 광고 호출 기록, `get_ad_stats()` | ✅ |
| `20260804000000_guest_nickname_en.sql` | 기본 닉네임 `게스트-` → `Guest-` | ✅ |
| `20260804100000_toss_login.sql` | `toss_accounts` 테이블 — 앱인토스 토스 로그인 | ✅ 2026-08-04 |
| `20260806000000_toss_anon_keys.sql` | `toss_anon_keys` — 토스 식별키, 프로모션 중복 지급 기준 | ✅ |
| `20260806100000_promotion_grants.sql` | `promotion_grants` — 프로모션 지급 이력 (식별키 단위) | ✅ |
| `20260806200000_promotion_status.sql` | `my_promotion_status()` — 안내 화면이 읽는 진행 상황 | ✅ |
| `20260806300000_promotion_plays_since.sql` | 판 수를 접속 보상 이후로만 세도록 수정 | ✅ |
| `20260806400000_promotion_failures.sql` | `promotion_failures` — 지급 거절 사유 기록 | ✅ |
| `20260806500000_promotion_failures_dedup.sql` | 실패 기록을 (식별키, 단계, 코드) 한 줄로 묶고 횟수를 센다 | ✅ |
| `20260806600000_promotion_state.sql` | 프로모션 종료를 앱이 알게 한다 | ✅ |
| `20260806700000_promotion_end_manual.sql` | 프로모션 종료 스위치를 클라이언트 손에서 뺀다 | ✅ |
| `20260807000000_ad_views_medium.sql` | `ad_views.medium` 컬럼 — 매체 구분, `get_ad_stats()` 재정의 | ✅ 2026-08-07 |
| `20260807100000_ad_views_purge_untagged.sql` | 매체 없는 기존 광고 기록 삭제 (위 파일 다음에) | ✅ 2026-08-07 |
| `20260808000000_game_votes.sql` | `game_votes` 테이블 — 게임별 좋아요·싫어요, 하루 한 표 | ✅ 2026-08-08 |
| `20260808100000_game_vote_stats.sql` | `get_game_vote_stats()` — 인기도 화면 집계 | ✅ 2026-08-08 |
| `20260808200000_stats_calendar_periods.sql` | 통계 4개 함수의 기간을 달력 구간(`p_from`·`p_to`)으로 — 롤링(`p_days`) 폐기 | |
| `20260811000000_calendar_rankings.sql` | 랭킹도 달력 구간으로 — `get_leaderboard()`·`get_my_stats()` 인자 교체, `get_hall_of_fame()` 신설 | ✅ 2026-08-11 |

## 테이블

| 테이블 | 용도 | RLS |
| --- | --- | --- |
| `profiles` | `auth.users`와 1:1. 닉네임, `nickname_set` | 조회 전체 공개 / 수정은 본인만 / insert는 가입 트리거만 |
| `scores` | append-only 점수 기록 | 조회 전체 공개 / insert는 본인만 / update·delete 정책 없음(금지) |
| `play_sessions` | 플레이 시간 기록 (인기도 산출용) | 조회 전체 공개 / insert는 본인만 |
| `admin_emails` | 관리자 이메일 목록 | **정책 없음** = 클라이언트 접근 불가. 추가는 대시보드에서 직접 |
| `game_flags` | 게임 고정·숨김·휴지통 | 조회 전체 공개 / 쓰기는 관리자만 |
| `feedback` | 사용자 의견 (버그·문의·제안) | insert는 본인만 / **조회·삭제는 관리자만** / update 정책 없음(금지) |
| `ad_views` | 리워드 광고 호출 기록 (매체·게임·자리·결과). 테스트 광고는 담지 않는다 | insert는 본인만 / **조회는 관리자만** / update·delete 정책 없음(금지) |
| `toss_accounts` | 토스 `userKey` ↔ `auth.users`. 앱인토스 전용 | **정책 없음** — service_role(서버 함수)만 다룬다 |
| `game_votes` | 게임별 좋아요·싫어요. 기본키 `(user_id, game_slug, vote_day)`가 '하루 한 표'를 지킨다 | 쓰기는 본인만 / **조회는 관리자만**(`get_game_vote_stats()`) |

삭제 연쇄: `auth.users` → `profiles` → `scores`·`play_sessions`·`feedback`·`ad_views`·`game_votes` 순으로
`on delete cascade`가 걸려 있다. 최상위 한 줄만 지우면 전부 따라 지워진다.
(탈퇴하면 그 사람이 보낸 의견도 함께 사라진다 — 개인정보처리방침대로다.)

## 함수 (RPC)

| 함수 | 호출하는 곳 | 권한 |
| --- | --- | --- |
| `get_leaderboard(p_game_slug, p_from, p_to, p_limit)` | 랭킹 화면 (이번 주·이번 달, KST) | 공개 |
| `get_my_stats(p_from, p_to)` | 홈 화면(이번 달 순위), 게임 진입 시 최고점 동기화 | 로그인 사용자 |
| `get_hall_of_fame(p_from, p_to, p_top)` | 명예의 전당 — 지난달 게임별 1~3위 | 공개 |
| `get_game_popularity()` | 홈 정렬 | 공개 |
| `get_game_stats(p_from, p_to)` | 관리자 통계 | `is_admin()` 아니면 `forbidden` |
| `get_total_players(p_from, p_to)` | 관리자 통계 | `is_admin()` 아니면 `forbidden` |
| `get_player_stats(p_from, p_to)` | 관리자 통계 → 이용자별 상세 | `is_admin()` 아니면 `forbidden` |
| `get_ad_stats(p_from, p_to)` | 관리자 통계 → 광고 현황 | `is_admin()` 아니면 `forbidden` |
| `get_game_vote_stats(p_start, p_end)` | 관리자 인기도 (`/admin/votes`) | `is_admin()` 아니면 `forbidden` |
| `is_admin()` | 라우트 가드, 다른 함수의 권한 검사 | 공개 (결과만 boolean) |
| `delete_my_account()` | 계정 삭제 화면 | `authenticated`만. `auth.uid()` 본인 것만 지운다 |

통계 네 함수의 기간은 화면이 보는 사람의 시간대로 계산한 절대 시각 구간이다.
`p_from`은 구간에 들고 `p_to`는 들지 않으며, 둘 다 null이면 전체 누적이다.

트리거로만 도는 함수는 클라이언트가 직접 부르지 않는다 — `handle_new_user()`(가입 시 프로필 생성),
`check_score_rate_limit()`·`check_session_rate_limit()`·`check_feedback_rate_limit()`·`check_ad_view_rate_limit()`(분당 제출 상한).

### 권한 설계 원칙

화면을 숨기는 것으로는 API 직접 호출을 막지 못한다. 그래서 관리자 전용 데이터는
**함수 안에서 `is_admin()`을 검사**하고, 나머지는 RLS로 막는다.
`security definer` 함수는 RLS를 우회하므로 추가할 때마다 권한 검사를 빠뜨리지 말 것.

## SQL로 처리되지 않는 대시보드 설정

마이그레이션을 다 돌려도 아래는 따로 해야 한다. 프로젝트를 새로 만들 때 특히 주의.

- **Authentication → Providers** — Google, Kakao 활성화 (각 콘솔의 client id/secret 입력)
- **Authentication → Providers** — Manual Linking 활성화 (`linkIdentity()` 사용)
- **Authentication → Providers** — 익명 로그인(Anonymous sign-ins) 활성화
- **Authentication → URL Configuration → Redirect URLs** — 배포 주소 + `/settings` 등록
- **Authentication → Providers → Email 활성화** — 메일은 보내지 않는다. 앱인토스 토스
  로그인이 다른 기기의 계정 세션을 만들 때 쓰는 `generateLink`가 이 provider를 탄다
- **Project Settings → API Keys → `service_role`** — 서버 함수(`api/toss-login.ts`)가
  쓴다. RLS를 우회하는 키라 프론트에는 절대 넣지 않는다 (`APPS_IN_TOSS.md` 참고)
- **관리자 등록** — `admin_emails`에 이메일 직접 insert. RLS 정책이 없어 대시보드에서만 가능

## 새 마이그레이션을 추가할 때

1. `supabase/migrations/`에 `YYYYMMDDHHMMSS_이름.sql`로 작성
2. 여러 번 돌려도 안전하게 쓴다 (`if not exists`, `create or replace`, `drop policy if exists`)
3. 대시보드 SQL Editor에서 실행
4. **이 문서의 적용 현황 표에 한 줄 추가하고 적용일을 적는다**
