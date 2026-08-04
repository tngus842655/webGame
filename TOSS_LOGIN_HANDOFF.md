# 토스 로그인 이어서 하기

2026-08-04 작업분 인수인계. **어떻게 동작하고 무엇을 설정해야 하는지**는
[APPS_IN_TOSS.md](./APPS_IN_TOSS.md)에, 대시보드 설정은 [SUPABASE.md](./SUPABASE.md)에,
토스 원문 가이드는 [toss-docs/](./toss-docs/)에 있다.
여기는 **어디까지 됐고 어디서부터 이어서 만지면 되는지**만 적는다.

브랜치 `claude/apptoss-account-linking-x1tfbi` · 커밋 9개 (`36aeddb`…`6735e66`)

---

## 1. 지금 상태 한 줄

앱인토스에서 구글·카카오를 빼고 토스 로그인을 붙였다. **실기기에서 동작 확인까지 끝났고**,
마지막 커밋 하나가 아직 배포되지 않았다.

| 항목 | 상태 |
|---|---|
| 설정 화면에 토스 로그인만 노출 | ✅ 실기기 확인 |
| 약관 동의 화면 | ✅ 실기기 확인 |
| 연동 후 랭킹 기록 유지 | ✅ 실기기 확인 |
| 실명으로 닉네임 자동 설정 + 안내 문구 | ✅ 실기기 확인 |
| 이메일을 계정 주소로 저장 | ⬜ 콘솔 동의 항목 변경 후 미확인 |
| 다른 기기에서 로그인 (계정 복구) | ⬜ **한 번도 안 돌려봤다** |
| 계정이 지워진 사람 자동 재시작 | ⬜ 미배포 (`6735e66`) |

---

## 2. 왜 이렇게 만들었나

**앱인토스는 미니앱 안에서 다른 로그인을 금지한다.** 추측이 아니라 문서에 그대로 있다
(`toss-docs/login-intro.md:22`): "미니앱에서 로그인 기능은 토스 로그인만 사용할 수 있어요.
자사 로그인이나 다른 간편 로그인 방식은 사용할 수 없어요."

정책과 별개로 **웹뷰에서 구글 로그인은 어차피 동작하지 않았다.** 구글이 임베디드 웹뷰의
OAuth를 거부하고(`disallowed_useragent`), 미니앱에는 Capacitor가 없어 커스텀 탭으로
빠지는 경로(`isNative`)도 타지 않는다. 즉 이 작업은 정책 대응이자 버그 수정이다.

### 식별키(`getAnonymousKey`) 대신 토스 로그인을 쓴 이유

앱인토스에는 사용자를 식별하는 길이 둘이다. 작업 중반에 이 갈림길을 다시 검토했고
(`toss-docs/user-hash-key-develop.md`), 토스 로그인 쪽으로 결론지었다.

| | 토스 로그인 `appLogin()` | 식별키 `getUserKeyForGame()` |
|---|---|---|
| 서버 | **필수** (mTLS 교환) | 불필요 |
| 동의 화면 | 뜬다 | 없다 |
| 이름·이메일 | 받을 수 있다 | 못 받는다 |
| 콘솔 약관 설정 | 필요 | 불필요 |

식별키가 더 싸 보이지만, **제대로 쓰려면 결국 서버가 필요하다.** 서버 없이 쓰면 `hash`가
Supabase 비밀번호 역할을 하게 되어 그 값이 새면 계정이 통째로 넘어간다. 검증 API
(`/users/anon-key/verify`)를 부르려면 그것도 mTLS 서버 간 통신이다. 같은 서버가 필요하다면
이름을 받아 닉네임을 채울 수 있는 쪽이 낫다고 판단했다.

**미해결**: 문서는 "게임은 `getUserKeyForGame`, 비게임은 `getAnonymousKey`"라는데,
SDK 2.10.8은 `getUserKeyForGame`에 deprecated를 달고 `getAnonymousKey`를 쓰라고 한다.
SDK 쪽이 최신으로 보이지만 실기기로 확인해야 안다. 식별키로 갈아탈 일이 생기면 이것부터.

### Supabase에 토스 provider가 없다

그래서 `linkIdentity`를 쓸 수 없다. `toss_accounts` 표로 토스 `userKey`와 `auth.users`를
직접 잇는다. **연동은 지금 쓰던 익명 계정에 `userKey`를 붙이는 방식이라 `user_id`가
그대로다** — 구글·카카오의 `linkIdentity`와 같은 의미이고, 기록을 옮길 필요가 없다.

세션 발급도 직접 만들어야 했다. Supabase에는 "이 유저의 세션을 만들어라"는 관리자 API가
없어서, 메일을 보내지 않는 매직링크 토큰(`generateLink`)을 서버가 만들어 넘기고
클라이언트가 `verifyOtp`로 받는다. **Email provider를 켜야 하는 이유가 이것뿐이다.**

### 서버를 Vercel에 둔 이유

앱인토스 API는 **mTLS 클라이언트 인증서가 유일한 인증 수단**이다 — client id도 secret도
없고 인증서의 `CN`(=appName)이 곧 자격증명이다. 대안이 없으므로 클라이언트 인증서를
확실히 붙일 수 있는 곳이어야 했다. Vercel Node 런타임은 `node:https`에 `cert`/`key`를
그대로 넘긴다. Supabase Edge Function(Deno)은 지원 여부가 불확실해서 접었다.

`fetch`로는 클라이언트 인증서를 붙일 수 없어 `api/toss-login.ts`는 `node:https`를 직접 쓴다.

---

## 3. 흐름

```
미니앱  appLogin()                   인가 코드 (10분, 일회성)
   ↓    POST /api/toss-login         인가 코드 + 지금 세션의 액세스 토큰
서버    generate-token               mTLS로 교환 → AccessToken
        login-me                     → userKey, 이름·이메일(암호화)
        AES-256-GCM 복호화           IV 앞 12바이트, 태그 뒤 16바이트, AAD=TOSS
        toss_accounts 조회
   ↓
   ├ 처음 보는 userKey  →  지금 쓰던 익명 계정에 묶는다      (mode: linked)
   │                       user_id 그대로 = 점수·랭킹 유지
   └ 이미 묶인 계정     →  그 계정의 세션 토큰을 발급         (mode: switched)
                           클라이언트가 verifyOtp로 받는다
```

---

## 4. 만든 것

| 파일 | 역할 |
|---|---|
| `api/toss-login.ts` | 인가 코드 교환, 복호화, 계정 연결. **새로 생긴 서버** |
| `supabase/migrations/20260804100000_toss_login.sql` | `toss_accounts` (userKey ↔ auth.users) |
| `src/shared/toss.ts` | `isInToss` 빌드 플래그, `appLogin` 호출 |
| `tsconfig.api.json` | 서버 함수는 Node 환경이라 따로 둔다 (`npm run typecheck:api`) |
| `.env.toss` | `VITE_TOSS=1`, 엔드포인트 주소 |

손댄 것: `auth.ts`(토스 로그인·계정 복구), `SettingsPage.vue`(분기·버튼),
`granite.config.ts`(`--mode toss`), `vercel.json`(`/api` 제외), 약관·개인정보·탈퇴 문구,
로케일 13개, `.gitignore`(인증서 차단).

### 빌드가 갈리는 방식

`.ait`는 자산을 통째로 넣어 따로 올리므로 실행 중 판별 대신 빌드 때 가른다.
`granite.config.ts`의 build가 `vite build --mode toss`를 돌리고 `.env.toss`의 `VITE_TOSS=1`을
`isInToss`가 읽는다. SDK의 `getOperationalEnvironment()`도 있지만 일반 브라우저에서 부르면
브릿지가 없어 예외를 던진다 — 웹과 코드를 공유하는 지금 구조에는 빌드 플래그가 맞다.

웹 빌드에는 토스 SDK가 아예 실리지 않는 것까지 확인했다(엔드포인트가 `undefined`로
치환되면서 동적 import까지 통째로 떨어져 나간다).

---

## 5. 중간에 잡은 버그 셋

**연동에 성공하고도 "연동하지 못했어요"가 떴다.** 토큰 갱신이 실패하면 연동 전체를 실패로
처리하고 있었는데, 그 시점에는 서버에서 연동이 이미 끝난 뒤라 되돌릴 수도 없었다.
그래서 한 번 더 누르면 "이미 연동된 계정" 경로를 타서 성공하는 것처럼 보였다.
갱신 실패는 이제 넘어간다 — 화면은 곧 `getUser()`로 최신 계정을 다시 읽는다.

**계정이 지워지면 점수 저장이 조용히 실패했다.** JWT는 계정 유무와 무관하게 만료 전까지
형식상 유효해서 세션만 봐서는 알 수 없다. 복구 장치가 설정 화면(`fetchMyProfile`)에만
있어서, 게임만 하는 사람은 한동안 모른다. 모든 쓰기가 지나는 `ensureUserId`에서 저장된
세션을 이번 실행에 처음 쓸 때 `profiles` 행을 한 번 확인하도록 옮겼다.

**익명 로그인이 두 번 일어날 수 있었다.** 게임에 들어가면 `startPlayTracking`과
`startScoreGuard`가 나란히 `ensureUserId()`를 부르는데, 세션을 새로 만들어야 하는
상황에서는 각자 로그인해 계정이 둘 생긴다. 원래 있던 문제인데 위 복구 경로가 정확히
그 상황이라 함께 막았다(진행 중인 요청 하나를 공유).

---

## 6. 남은 일

**배포** — `6735e66`(계정 복구)이 아직 안 나갔다. `src/` 변경이라 **`.ait`도 다시 말아야
한다**(`npm run build:toss` → 콘솔 버전 등록). 안드로이드도 같은 수정이 필요하지만
급하지 않으니 다음 릴리스에 묶어도 된다.

**콘솔 동의 항목에 이메일 추가** — 개인정보처리방침에는 이미 이메일이 적혀 있다.
콘솔과 앱 고지가 어긋나면 심사에서 지적받을 수 있으니 둘을 같이 맞춰야 한다.

**미니앱 이름** — 첫 검토 요청이 "미니앱 이름이 앱 정보등록에 제출된 이름과 동일해야
해요"로 반려됐다. `granite.config.ts`의 `brand.displayName`이 `MiniGame30`인데 콘솔
앱 정보는 `미니게임30`이었다. 한글로 맞췄으니 **다시 빌드해서 올려야 한다.**

**다른 기기 로그인 테스트** — `switched` 경로가 한 번도 안 돌았다. Supabase
Authentication → Providers → **Email이 켜져 있어야** 동작한다. 이게 꺼져 있으면
첫 연동은 되고 기기 전환만 실패해서 원인 찾기가 성가시다.

**연결 끊기 콜백** — 보류했다. 동의 항목이 이름·이메일·성별 안에 있으면 등록이 의무는
아니다. 지금은 사용자가 토스 앱에서 연결을 끊어도 게임은 로그인 상태로 남는다.
붙이려면 `POST` 엔드포인트 하나와 콘솔 등록(URL + Basic Auth)이 필요하고,
`referrer`가 `UNLINK`/`WITHDRAWAL_TERMS`/`WITHDRAWAL_TOSS` 셋으로 온다.

---

## 7. 알려진 한계

**웹·안드로이드 계정과는 이어지지 않는다.** `userKey`가 앱 단위 값이라 같은 사람이라도
미니앱이 다르면 값이 달라진다(`toss-docs/login-develop.md:252`). 막을 방법이 없다.

**이메일이 겹치면 물러난다.** 웹에서 구글로 가입한 사람이 미니앱에서 토스 로그인하면
같은 주소를 두 계정이 쓰게 되는데, Supabase는 이메일이 계정마다 유일해야 하고 두 계정을
합칠 방법이 없다. 그때는 `toss-<userKey>@minigame30.invalid`로 물러난다.
토스 가입 시 이메일이 필수가 아니라 값 자체가 없는 사람도 같은 처리를 받는다.

**Users 화면에서 Provider type이 `-`로 뜬다.** Supabase가 토스를 모르기 때문이다.
구글·카카오는 내장 OAuth provider라 `Social`로 분류되지만 토스 provider는 없어서
`email` identity로 계정을 만든다. 기능에는 영향이 없다 — 연동 여부는
`user_metadata.toss_user_key`로 판단한다.

**복호화 키는 이름·이메일에만 쓴다.** `userKey`는 평문으로 온다. 다른 개인정보 항목을
받기 시작하면 연결 끊기 콜백 등록이 의무가 되니 그때 함께 검토할 것.

---

## 8. 검증한 방법

실기기 확인 외에 코드로 확인한 것들. 토스 도메인이 세션에서 차단되어 API 실호출은
로컬에서 불가능했다.

| 확인한 것 | 방법 |
|---|---|
| 인증서와 개인키가 짝인지 | `openssl` modulus 비교 — 일치 |
| 복호화 규격 | 실제 키로 왕복 테스트 + AAD 틀리면 실패하는 것까지 |
| PEM을 붙여넣다 깨지는 경우 | `tls.createSecureContext`로 네 가지 모양 시험 — 앞쪽 공백만 문제 |
| 웹 빌드에 토스 코드가 안 실리는지 | 빌드 산출물 grep |
| 타입 | `npm run typecheck` + `npm run typecheck:api` |
