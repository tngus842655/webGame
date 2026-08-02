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
| `20260803000000_ad_views.sql` | `ad_views` 테이블 — 리워드 광고 호출 기록, `get_ad_stats()` | ⬜ **실행 필요** |

## 테이블

| 테이블 | 용도 | RLS |
| --- | --- | --- |
| `profiles` | `auth.users`와 1:1. 닉네임, `nickname_set` | 조회 전체 공개 / 수정은 본인만 / insert는 가입 트리거만 |
| `scores` | append-only 점수 기록 | 조회 전체 공개 / insert는 본인만 / update·delete 정책 없음(금지) |
| `play_sessions` | 플레이 시간 기록 (인기도 산출용) | 조회 전체 공개 / insert는 본인만 |
| `admin_emails` | 관리자 이메일 목록 | **정책 없음** = 클라이언트 접근 불가. 추가는 대시보드에서 직접 |
| `game_flags` | 게임 고정·숨김·휴지통 | 조회 전체 공개 / 쓰기는 관리자만 |
| `feedback` | 사용자 의견 (버그·문의·제안) | insert는 본인만 / **조회·삭제는 관리자만** / update 정책 없음(금지) |
| `ad_views` | 리워드 광고 호출 기록 (게임·자리·결과) | insert는 본인만 / **조회는 관리자만** / update·delete 정책 없음(금지) |

삭제 연쇄: `auth.users` → `profiles` → `scores`·`play_sessions`·`feedback`·`ad_views` 순으로
`on delete cascade`가 걸려 있다. 최상위 한 줄만 지우면 전부 따라 지워진다.
(탈퇴하면 그 사람이 보낸 의견도 함께 사라진다 — 개인정보처리방침대로다.)

## 함수 (RPC)

| 함수 | 호출하는 곳 | 권한 |
| --- | --- | --- |
| `get_leaderboard(p_game_slug, p_since, p_limit)` | 랭킹 화면 | 공개 |
| `get_my_stats()` | 홈 화면 (내 최고점·순위) | 로그인 사용자 |
| `get_game_popularity()` | 홈 정렬 | 공개 |
| `get_game_stats(p_days)` | 관리자 통계 | `is_admin()` 아니면 `forbidden` |
| `get_total_players(p_days)` | 관리자 통계 | `is_admin()` 아니면 `forbidden` |
| `get_player_stats(p_days)` | 관리자 통계 → 이용자별 상세 | `is_admin()` 아니면 `forbidden` |
| `get_ad_stats(p_days)` | 관리자 통계 → 광고 현황 | `is_admin()` 아니면 `forbidden` |
| `is_admin()` | 라우트 가드, 다른 함수의 권한 검사 | 공개 (결과만 boolean) |
| `delete_my_account()` | 계정 삭제 화면 | `authenticated`만. `auth.uid()` 본인 것만 지운다 |

트리거 두 개는 클라이언트가 직접 부르지 않는다 — `handle_new_user()`(가입 시 프로필 생성),
`check_score_rate_limit()`·`check_session_rate_limit()`·`check_ad_view_rate_limit()`(분당 제출 상한).

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
- **관리자 등록** — `admin_emails`에 이메일 직접 insert. RLS 정책이 없어 대시보드에서만 가능

## 새 마이그레이션을 추가할 때

1. `supabase/migrations/`에 `YYYYMMDDHHMMSS_이름.sql`로 작성
2. 여러 번 돌려도 안전하게 쓴다 (`if not exists`, `create or replace`, `drop policy if exists`)
3. 대시보드 SQL Editor에서 실행
4. **이 문서의 적용 현황 표에 한 줄 추가하고 적용일을 적는다**
