# 앱인토스 (토스 미니앱)

웹 게임을 토스 앱 안의 미니앱으로 내보내는 방법과 콘솔 설정을 적어 둔다.
안드로이드(Play) 쪽은 `ANDROID_RELEASE.md` / `PLAY_CONSOLE.md`에 있다.

**웹 배포와 다른 점:** 앱인토스는 **웹 자산을 번들 안에 통째로 넣어 올린다.**
사이트를 고쳐도 자동 반영되지 않고, 매번 다시 빌드해서 새 버전을 등록해야 한다.
안드로이드(Capacitor) 쪽도 지금은 같은 방식이다.

| 항목 | 값 |
| --- | --- |
| appName | `minigame30` |
| 표시 이름 | `미니게임30` |
| 카테고리 | 게임 |
| SDK | `@apps-in-toss/web-framework` 2.10.8 |
| 설정 파일 | `granite.config.ts` |
| 콘솔 | https://apps-in-toss.toss.im |

---

## 다음 버전 올릴 때 (평소에 보는 곳)

```bash
dist 폴더, minigame30.ait 삭제(이전빌드정보)
npm run build:toss     # 루트에 minigame30.ait 생성 (약 11MB)
```

콘솔 → 앱 출시 → **[버전 등록]** → `.ait` 업로드 → **[테스트]**로 QR 받아 실기기 확인
→ **[검토 요청]**. 검토는 영업일 기준 최대 3일.

`.ait`은 빌드 산출물이라 git에 올리지 않는다 (`.gitignore`에 `*.ait`, `.granite/`).

---

## 스크립트를 `:toss`로 나눈 이유

`ait init`을 그냥 돌리면 `dev`/`build`를 각각 `granite dev`/`ait build`로 **덮어쓴다.**
그러면 Vercel·Cloudflare가 실행하는 `npm run build`가 웹 빌드가 아니라 미니앱 번들을
만들게 되어 **웹 배포가 깨진다.** 그래서 init을 돌리지 않고 손으로 설정했다.

| 스크립트 | 용도 |
| --- | --- |
| `dev` / `build` | 웹 (Vercel·Cloudflare). 건드리지 않았다 |
| `dev:toss` | 앱인토스 개발 서버 |
| `build:toss` | `.ait` 생성 |
| `deploy:toss` | 콘솔 안 거치고 CLI로 업로드 |
| `typecheck:api` | 서버 함수(`api/`). Node 환경이라 tsconfig가 따로 있다 |

---

## granite.config.ts

| 키 | 값 | 이유 |
| --- | --- | --- |
| `webViewProps.type` | `'game'` | **이 값이 `'game'`이어야 게임 미니앱으로 빌드된다.** 비게임 웹뷰는 TDS(토스 디자인 시스템) 적용이 의무라, 아니면 지금 UI를 전부 갈아엎어야 한다 |
| `web.commands.dev` | `vite --mode toss` | `.env.toss`를 읽어 토스 로그인 분기를 켠다 |
| `brand.icon` | Vercel의 512 아이콘 URL | 파일 업로드가 아니라 URL 참조다. **그 배포가 살아 있어야 한다** |
| `brand.primaryColor` | `#FFCA28` | 아이콘의 금색 "30"과 앱 팔레트에서 가장 많이 쓰인 앰버 |
| `brand.displayName` | `미니게임30` | **콘솔 '앱 정보'의 이름과 글자 하나까지 같아야 한다.** `MiniGame30`으로 뒀다가 "미니앱 이름이 앱 정보등록에 제출된 이름과 동일해야 해요"로 반려됐다. 앱 정보 쪽을 바꾸는 것도 방법이지만, 스토어에 노출되는 이름이라 한글이 낫다 |
| `permissions` | `[]` | 카메라·위치·연락처 안 쓴다 |
| `web.commands.build` | `vue-tsc --noEmit && vite build --mode toss` | `build:toss`가 이걸 돌린 뒤 결과를 묶는다 |
| `outdir` | `dist` | vite 기본값 |

빌드하면 번들 안에 위 값이 그대로 주입된다 (`bundle.ios.*.js`에서 `brandDisplayName`,
`webViewType` 등으로 확인 가능).

---

## MCP — AI가 앱인토스 문서를 보게 하는 설정

로컬 PC에서 한 번만 하면 `~/.claude.json`에 남는다.
**Claude Code 웹 세션에서는 안 된다** — 컨테이너 네트워크 정책이 `toss.im`을 막는다.

```bash
npm i -g @apps-in-toss/ax          # Node 22.9 이상 필요

claude mcp add -s user apps-in-toss -- ax mcp

claude mcp add -s user --transport http apps-in-toss-console \
  https://mcp.toss.im/adapters/apps-in-toss-console/mcp --client-id mcp-gateway
```

붙인 뒤 `claude` 실행 → `/mcp` → `apps-in-toss-console` 선택 → 브라우저 인증.

| 서버 | 하는 일 |
| --- | --- |
| `apps-in-toss` | 개발문서·TDS 문서 검색 (`ax` CLI, stdio) |
| `apps-in-toss-console` | 콘솔 작업 — 미니앱 생성, 번들 업로드, 검토 요청, 롤백 |

SDK가 자주 바뀌므로(2.10.8이 이 문서 작성일에도 갱신됨) 코드를 짜기 전에 문서 MCP를
거치는 편이 낫다.

---

## 로그인 — 토스 로그인만 쓴다

**앱인토스는 미니앱 안에서 다른 로그인을 금지한다.** 문서에 그대로 적혀 있다
(`toss-docs/login-intro.md`): "미니앱에서 로그인 기능은 토스 로그인만 사용할 수 있어요.
자사 로그인이나 다른 간편 로그인 방식은 사용할 수 없어요." 그래서 미니앱 빌드에서는
설정 화면의 구글·카카오를 감추고 토스 로그인 하나만 남긴다.

정책과 별개로 **웹뷰 안에서 구글 로그인은 어차피 동작하지 않는다** — 구글이 임베디드
웹뷰의 OAuth를 거부하고(`disallowed_useragent`), 미니앱은 Capacitor가 없어 커스텀 탭으로
빠지는 경로(`isNative`)도 타지 않는다.

### 갈라지는 방식

빌드가 애초에 따로 나가므로(`.ait`에 자산을 통째로 넣는다) 실행 중 판별 대신 빌드 때
가른다. `granite.config.ts`의 build가 `vite build --mode toss`를 돌리고, `.env.toss`의
`VITE_TOSS=1`을 `src/shared/toss.ts`의 `isInToss`가 읽는다.

SDK의 `getOperationalEnvironment()`도 있지만 일반 브라우저에서 부르면 브릿지가 없어
예외를 던진다. 웹과 코드를 공유하는 지금 구조에는 빌드 플래그가 맞다.

### 흐름

```
미니앱  appLogin()               인가 코드 (10분, 일회성)
   ↓    POST /api/toss-login     인가 코드 + 지금 세션의 액세스 토큰
서버    generate-token           mTLS로 교환 → AccessToken
        login-me                 → userKey (앱 단위 식별자, 숫자)
        toss_accounts 조회
   ↓
   ├ 처음 보는 userKey  → 지금 쓰던 익명 계정에 묶는다 (mode: linked)
   │                      user_id가 그대로라 점수·랭킹이 유지된다
   └ 이미 묶인 계정     → 그 계정의 세션을 발급한다 (mode: switched)
```

Supabase Auth에는 토스 provider가 없어 `linkIdentity`를 쓸 수 없다. 그래서 `toss_accounts`
표로 userKey ↔ `auth.users`를 직접 잇고, 세션이 필요할 때는 메일을 보내지 않는
매직링크 토큰을 만들어 클라이언트가 `verifyOtp`로 받는다.

**userKey는 앱 단위 식별자다.** 같은 사람이라도 미니앱이 다르면 값이 달라져서,
웹·안드로이드의 구글/카카오 계정과는 이어지지 않는다. 이건 막을 방법이 없다.

### 서버를 Vercel에 둔 이유

앱인토스 API는 **mTLS 클라이언트 인증서가 유일한 인증 수단**이다 — client id도 secret도
없고, 인증서의 `CN`(=appName)이 곧 자격증명이다. 그래서 클라이언트 인증서를 확실히
붙일 수 있는 곳이어야 했다. Vercel Node 런타임은 `node:https`에 `cert`/`key`를 그대로
넘길 수 있다. Supabase Edge Function(Deno)은 지원 여부가 불확실해서 접었다.

`fetch`로는 클라이언트 인증서를 붙일 수 없어 `api/toss-login.ts`는 `node:https`를 직접 쓴다.

### 필요한 설정

Vercel → Settings → Environment Variables:

| 변수 | 값 |
| --- | --- |
| `TOSS_CLIENT_CERT` | 콘솔에서 받은 `.crt` 전문 (PEM) |
| `TOSS_CLIENT_KEY` | 같이 받은 `.key` 전문 (PEM) |
| `TOSS_DECRYPT_KEY` | 콘솔에서 메일로 받은 복호화 키 (base64) |
| `TOSS_DECRYPT_AAD` | 같이 받은 AAD. 안 넣으면 `TOSS`로 본다 |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role 키.** `VITE_` 접두사를 붙이면 번들에 실려 나간다 |

URL은 따로 넣지 않아도 된다 — 이미 등록된 `VITE_SUPABASE_URL`을 읽는다. 비밀이 아니라
어차피 클라이언트 번들에 박혀 나가는 값이다. 굳이 나누고 싶으면 `SUPABASE_URL`을
등록하면 그쪽을 먼저 본다.

인증서 파일은 저장소에 두지 않는다 (`.gitignore`에 `*.key`, `*.crt`, `*.pem`, `*.p12`).
유효기간은 발급일로부터 약 1년이라 만료 전에 콘솔에서 재발급해야 한다.

Supabase 대시보드:

- Authentication → Providers → **Email 활성화.** 메일을 보내지는 않지만, 세션 발급에
  쓰는 `generateLink`가 이 provider를 탄다
- `supabase/migrations/20260804100000_toss_login.sql` 적용

앱인토스 콘솔 (`toss-docs/login-intro.md`):

- 토스 로그인 약관 동의 (대표 관리자 계정만 가능)
- **동의 항목(scope) — 이름과 이메일.** 이름은 구글·카카오와 똑같이 연동 직후 닉네임
  초기값으로 쓴다. 랭킹에 실명이 뜰 수 있어서 `account.nicknameApplied` 안내가 그 자리에
  뜨고 바로 바꿀 수 있다. 이메일은 Supabase 계정 주소로 쓴다.
  **이름·이메일·성별 외의 항목을 고르면 연결 끊기 콜백 등록이 의무가 되므로** 그 셋을
  넘지 않는다

이메일은 토스 가입 시 필수가 아니라 동의를 받아도 값이 없을 수 있고, 웹에서 구글로
가입한 같은 사람이 이미 그 주소를 쓰고 있을 수도 있다. 두 경우 모두 수신이 불가능한
`toss-<userKey>@minigame30.invalid`로 물러난다 — Supabase는 계정마다 이메일이 유일해야
하는데 두 계정을 합칠 방법이 없다.
- 약관 등록 — `/terms`, `/privacy` 주소를 넣는다

`login-me`의 개인정보 필드는 암호화되어 온다. 복호화는 서버가 한다 — AES-256-GCM,
앞 12바이트가 IV, 끝 16바이트가 인증 태그, AAD는 콘솔에서 받은 값(`TOSS`).
복호화에 실패해도 로그인은 통과시킨다. 닉네임을 못 채울 뿐이다.

**웹·안드로이드 계정과는 이어지지 않는다.** `userKey`가 앱 단위 값이라 같은 사람이라도
미니앱이 다르면 값이 달라진다(`toss-docs/login-develop.md:252`). 막을 방법이 없다.

**Supabase Users 화면에서 Provider type이 `-`로 뜬다.** 구글·카카오는 내장 OAuth
provider라 `Social`로 분류되지만 토스 provider는 없어서 `email` identity로 계정을 만든다.
기능에는 영향이 없다.

---

## 아직 안 붙인 것

**연결 끊기 콜백**: 사용자가 토스 앱에서 연결을 끊으면(설정 → 인증 및 보안 →
토스로 로그인한 서비스) 등록한 URL로 알려 준다. 동의 항목이 이름·이메일·성별 안에
있으면 등록이 의무는 아니라서 미뤘다. 지금은 연결을 끊어도 앱이 로그인 상태로 남는다.
붙이려면 `POST` 엔드포인트 하나와 콘솔 등록(URL + Basic Auth)이 필요하고,
`referrer`가 `UNLINK`/`WITHDRAWAL_TERMS`/`WITHDRAWAL_TOSS` 셋으로 온다.

---

## 현재 상태

끝난 것 — 빌드 환경(`granite.config.ts`, `:toss` 스크립트), MCP 연결, 콘솔 미니앱 생성,
웹뷰 전용 버그 3건 수정, **앱 승인**, 토스 로그인(실기기 확인 완료), 인앱광고 코드,
프로모션 코드, 콘솔 앱 정보.

남은 것:

- [ ] **다른 기기에서 로그인** — `switched` 경로가 한 번도 안 돌았다. Supabase
      Authentication → Providers → **Email이 켜져 있어야** 동작한다. 꺼져 있으면 첫 연동은
      되고 기기 전환만 실패해서 원인 찾기가 성가시다.
- [ ] **이메일을 계정 주소로 저장** — 콘솔 동의 항목에 이메일을 추가한 뒤 확인해야 한다.
      개인정보처리방침에는 이미 이메일이 적혀 있어, 콘솔과 앱 고지가 어긋나면 심사에서
      지적받을 수 있다.
- [ ] **인앱광고 운영 ID** — 광고 그룹 ID를 발급받아 재빌드하고 버전을 등록해야 한다
      (아래 '인앱광고' 표).
- [ ] **연결 끊기 콜백** — 위 '아직 안 붙인 것'.

---

## 인앱광고

### 웹의 AdSense를 미니앱에 그대로 쓸 수 없다

미니앱은 결국 **토스 앱 안의 웹뷰**이고, AdSense(H5 Games Ads)는 웹사이트용 상품이라
앱 웹뷰 게재는 프로그램 정책 위반이다 — 안드로이드 앱에 AdMob을 따로 붙인 것과 정확히
같은 이유다(`src/shared/ads.ts`의 `AdMobProvider` 주석). 정책을 접어 두더라도, 미니앱은
자산을 번들에 통째로 넣어 올리는 방식이라 AdSense가 요구하는 **크롤 가능한 사이트 URL이
아예 없다.** 실제로 게재가 안 되거나 무효 트래픽으로 잡힐 자리다.

그래서 매체가 셋으로 갈린다.

| 빌드 | 매체 | 환경 변수 |
| --- | --- | --- |
| 웹 (Vercel·Cloudflare) | H5 Games Ads (AdSense) | `VITE_ADSENSE_CLIENT` (`.env.local`) |
| 앱인토스 미니앱 | 토스 인앱광고 | `VITE_TOSS_AD_GROUP_ID` (`.env.toss`) |
| 안드로이드 앱 | AdMob | `VITE_ADMOB_REWARD_ID` (`.env.local`) |

가르는 방식은 토스 로그인과 같다 — `createProvider()`가 `isNative` → `isInToss` 순으로
보고 고른다. `isInToss`는 빌드 플래그라 **컴파일 타임에 상수**가 되고, 그래서 미니앱
번들에는 AdSense 쪽 코드가 통째로 안 실린다. `VITE_ADSENSE_CLIENT`를 채운 채로
`vite build --mode toss`를 돌려 산출물에 `adsbygoogle`이 한 글자도 없는 것을 확인했다.
(같은 조건의 웹 빌드에는 그대로 들어간다.)

### SDK 계약

`toss-docs/interstitial-rewarded-ad.md` 기준. 전면형과 보상형이 **같은 API**를 쓰고,
어느 쪽인지는 `adGroupId`가 정한다 — 그래서 콘솔에서 광고 유형을 `리워드`로 만들어야 한다.

```ts
loadFullScreenAd({ options: { adGroupId }, onEvent, onError }) // → 구독 해제 함수
showFullScreenAd({ options: { adGroupId }, onEvent, onError }) // → 구독 해제 함수
```

둘 다 `isSupported()`를 달고 있다. 콜백을 받고 **구독 해제 함수를 돌려주는** 형태라,
`TossAdProvider`가 이것을 한 번만 정해지는 Promise로 바꿔 기존 `AdProvider` 인터페이스에 맞춘다.

| 단계 | 이벤트 | `AdOutcome` |
| --- | --- | --- |
| load | `loaded` | 받아 둔 상태로 표시 |
| show | `userEarnedReward` → `dismissed` | `viewed` |
| show | `dismissed` (보상 없이) | `dismissed` |
| show | `failedToShow`, `onError` | `unavailable` |

`impression`·`clicked`·`show`·`requested`는 안 쓴다 — 보상 지급과 게임 재개를 가르는 데
필요한 건 위 넷뿐이다.

**받아 두는 것이 이 매체의 핵심이다.** 가이드가 `load → show → (다음 load)` 순서를 못박고,
FAQ가 로드 소요를 **토스애즈 1\~2초 / 애드몹 5\~20초, 최대 60초**로 적어 뒀다. 버튼을 누른
뒤에 부르면 그 시간만큼 게임이 멈춰 있게 되므로, **판에 들어올 때 미리 받아 둔다**
(`createGameContext`가 `adProvider.preload?.()`를 부른다). 띄운 광고는 소진되니 `show` 뒤에
다음 편을 다시 받는다. `isReady()`는 받아 뒀거나 받는 중일 때만 참이라, 받기가 실패한
뒤에는 광고 버튼이 아예 안 뜬다 — 눌러도 안 나올 버튼을 보여주지 않는 편이 낫다.

시간 제한 셋은 전부 **SDK가 아무 이벤트도 주지 않을 때를 위한 안전망**이고 정상 동작에서는
걸리지 않는다: 받아 두기 90초(화면을 막지 않고 뒤에서 돈다) · 버튼을 누른 뒤 대기 20초 ·
표시 3분. 마지막 것은 아래 알려진 버그 때문이다.

**알려진 버그** (가이드 FAQ, 안드로이드 토스앱)

- **5.255.0에서 `dismissed`가 오지 않는다.** 그래서 표시에 3분 안전망을 뒀다. 이때 보상은
  `userEarnedReward`를 받았는지로 가른다
- **5.266.0에서 여러 `adGroupId`를 동시에 로드하면 이벤트가 유실된다.** 지금은 그룹이 하나라
  해당 없지만, **배너를 붙이면 걸린다** — 그때는 순차 로드로 짜야 한다 (5.267.0/5.268.0에서
  개선)

**토스 앱 버전**: 5.227.0 미만은 미지원, 5.247.0 이상이라야 토스애즈+애드몹 통합이 돈다.
`isSupported()`가 이걸 판별하고, 거짓이면 받기를 포기한다.

배너(`TossAds.attachBanner`)는 안 붙였다. 지금 이 앱의 광고는 전부 사용자가 버튼을 눌러
보는 리워드 광고 하나뿐이고, 배너는 게임 화면 자리를 새로 잡아야 하는 별개의 일이다.

### 테스트

**운영 ID로 테스트하면 정책 위반이다.** 가이드가 테스트용 ID를 따로 준다.

| 광고 | 테스트 ID |
| --- | --- |
| 리워드 | `ait-ad-test-rewarded-id` |
| 전면형 | `ait-ad-test-interstitial-id` |

`.env.toss`에는 운영 ID를 두고, 테스트 번들만 환경 변수로 덮어쓴다. 셸 값이 `.env.toss`를
이긴다는 것과 그 값이 `.ait` 안까지 들어간다는 것을 확인했다.

```bash
VITE_TOSS_AD_GROUP_ID=ait-ad-test-rewarded-id npm run build:toss
```

**샌드박스(`npm run dev:toss`)에서는 인앱광고가 아예 동작하지 않는다.** 가이드가 명시한
제약이라 우회할 수 없다 — 콘솔에 번들을 올리고 **QR로 실기기에서** 확인해야 한다.

출시 전 확인 항목(가이드): 광고가 로드되는지 · 클릭 시 의도한 화면으로 가는지 ·
뒤로 가기가 정상인지 · 결제나 인증 흐름을 방해하지 않는지.

### 가이드가 요구하는 것 (`toss-docs/in-app-ad.md`)

- **광고 중에는 앱 사운드를 멈춘다.** `gameContext.showRewardAd`가 게임 루프와 함께 BGM도
  접는다. 결과 팝업에서 부르는 광고는 팝업이 이미 접어 둔 뒤라, 원래 흐르고 있던 경우에만
  되살린다. 이걸 넣기 전에는 인게임 광고(되돌리기·시간 추가·목숨 등 15곳 남짓)에서 BGM이
  그대로 흘렀다
- **SDK를 우회하지 않는다.** 자체 로직으로 광고를 호출하거나 Click/Impression 이벤트를
  변조하면 제재다. 지금 구현은 `loadFullScreenAd`/`showFullScreenAd`를 그대로 쓰고 광고 UI도
  건드리지 않는다. 위의 시간 제한들은 구독을 끊고 포기할 뿐이라 이벤트 변조가 아니다
- **광고 그룹 ID는 구글에 등록되기까지 최대 2시간.** 그 사이에는 로드가 실패하는데, 이 앱은
  `unavailable`이면 보상을 그냥 주므로 **"광고는 안 뜨는데 이어하기는 되는" 모습**으로 보인다.
  연동이 됐는지는 `ad_views`의 outcome으로 확인할 것

### 남은 것

- [x] 사업자 정보 등록, 정산 정보 등록·검토
- [x] 콘솔에서 **광고 유형 `리워드`로 광고 그룹 생성** (보상: `생명연장, 1`)
- [x] 구글 반영 완료, ID 발급 → `.env.toss`에 넣었다
- [x] 테스트 ID로 빌드해 실기기 확인 (광고 상단에 테스트 표시가 뜬다)
- [ ] 운영 ID 그대로 `npm run build:toss` → 콘솔에 버전 등록

**반영한 뒤 광고를 직접 보지 말 것.** 인위적인 노출·클릭은 무효 트래픽으로 잡혀 광고 제한,
정산 보류, 부당 수익 환수까지 간다. 가족 폰으로 보는 것도 같다 — 제재는 폰 주인이 아니라
게시자 계정에 쌓인다.

확인은 **광고를 보지 않고** 한다. `isReady()`가 실제 로드 상태라서 **이어하기 버튼이 뜨는
것 자체가 "ID가 유효하고 재고도 있다"는 신호**다. 버튼만 보고 누르지 않으면 노출은 0이다
(콘솔 분석 탭이 광고 요청·수신·노출 시도·노출 성공을 따로 세는데, 수익과 지표는 노출부터다).
30초쯤 놀다 죽어서 버튼이 뜨면 된 것이다. 실제 노출은 사용자가 생긴 뒤 `ad_views`로 본다.

---

## 프로모션

토스 포인트를 지급하는 이벤트. 원문은 `toss-docs/promotion.md`.

**이 앱은 게임이라 쓸 수 있는 폭이 좁다.** 게임 결과 기반 보상(점수·승패·등수)과 확률형·
랜덤(룰렛·뽑기)이 불가다 — 게임 결과와 현금성 보상을 직접 잇는 것이 사행성 유도로 금지되어
있어서다. 게임 결과와 **무관한** 조건만 쓸 수 있다: 가입, 로그인, 접속, 플레이 완료.

**"광고 보면 포인트"는 하지 말 것.** 광고 정책의 "광고 소비를 보상과 직접 연결하는 구조
금지"에 걸리고, 총론의 "광고 노출을 인위적으로 유도"에도 걸린다. 정책을 접어 두더라도
산수가 안 맞는다 — 1회 노출 수익이 eCPM 5,000원 기준 **5원**인데 포인트는 비즈 월렛의
우리 돈에서 나간다. 볼수록 손해다.

### 하기로 한 구성

프로모션은 광고 수익을 나눠주는 장치가 아니라 사용자를 사오는 장치다. 문을 여는 값은
싸게 두고, 실제로 붙잡는 쪽에 무게를 싣는다.

| 단계 | 조건 | 금액 | 근거 |
| --- | --- | --- | --- |
| 1 | 처음 접속 | 20원 | 허용 유형에 명시된 "회원가입·접속 보상" |
| 2 | 1판 마치기 | +30원 | 게임 결과와 무관한 행위 |
| 3 | 3판 마치기 | +50원 | 위와 같다 |

1인 100원. 5,000포인트 한도의 2%다. 예산 10만 원이면 전원이 완주해도 1,000명이고,
실제로는 중간 이탈이 있어 더 많이 들어온다.

**"1판"은 게임오버가 난 판이다.** 게임 화면에 들어간 것만으로는 세지 않는다 — 판정이
`scores` 표의 행 수를 세는데, 그 표는 게임 30여 개가 전부 `gameOver()`에서만 채운다
(`gameContext.submitScore` → `saveScore`). 화면 진입은 `play_sessions`에 남고 판정과 무관하다.
점수는 0이어도 되므로 바로 죽어도 1판으로 친다. 제출 빈도 제한이 분당 6회라 3판은
연달아 해도 걸리지 않는다.

**문구를 결과로 쓰지 말 것.** "3판 **하기**"는 되고 "3판 **이기기**"·"클리어"는 즉시 반려다.
체크리스트의 "시간이나 노동을 많이 요구하지 않나요?"는 30초짜리 게임 3판이라 방어할 수
있지만, 판단은 검수원에게 있다.

**판 수는 누적이다.** 1판에서 30원, 거기서 2판 더 해서 3판이 되면 50원이다. 3단계가
"1판 뒤에 3판 더"(총 4판)가 아니다 — 고지 문구가 "3판이면 100원"으로 떨어지는 쪽이
단순하고, 노동 조항에서도 유리하다.

**리뷰 작성은 뺐다.** SDK의 `requestReview()`가 `Promise<void>`라 **리뷰를 썼는지 앱이 알 수
없다.** 팝업을 띄웠다는 것만 안다. 그대로 만들면 "팝업을 닫기만 해도 지급"이 되어 고지한
조건과 실제 조건이 어긋난다. 리뷰는 포인트 없이 적당한 자리에서 띄우기만 한다.

### SDK 계약 (`@apps-in-toss/web-bridge` 2.10.8 타입 정의 기준)

```ts
grantPromotionReward(params: {
  params: { promotionCode: string; amount: number }
}): Promise<{key:string} | {errorCode:string; message:string} | 'ERROR' | undefined>
```

- **`amount`를 클라이언트가 넘긴다.** promotionCode가 금액을 고정하지 않는다. 그래서
  **프로모션 1건 + 코드 1개로 20/30/50을 다 지급할 수 있다** — 3건 등록할 필요가 없다.
  콘솔의 1회 지급 금액 한도만 50 이상으로 잡을 것 (아니면 `4114`)
- `grantPromotionRewardForGame`은 **deprecated**다. 게임 카테고리 제한이 없는
  `grantPromotionReward`를 쓴다
- 에러코드: `4112` 예산 부족 · `4113` 이미 지급됨 · `4114` 1회 지급 금액 초과 ·
  `4109` 실행중 아님 · `4105` 종료 · `undefined`는 토스앱 버전 미달
- `4113`이 무엇을 기준으로 막는지는 문서에 없다. **1차 방어선으로 믿지 말 것**

### 중복 방지는 우리가 짜야 한다

SDK에 멱등키가 없고, 진행도(1판 했는지, 3판 했는지)를 토스가 세주지 않는다.

기준값은 `getAnonymousKey()`가 주는 식별키다. **Supabase 익명 계정(user_id)은 앱 데이터를
지우면 새로 만들어져서 '1인 1회'를 셀 수 없다.** 토스 식별키는 미니앱별로 고유하고 같은
사람에게 항상 같은 값이라 지우고 들어와도 유지된다. 여기에 콘솔의 '1인 하루 최대 지급
금액'을 100으로 걸어 마지막 방어선을 둔다.

`toss-docs/user-hash-key-develop.md`는 게임 미니앱이 `getUserKeyForGame`을 쓰라고 하지만
**그 문서는 낡았다.** SDK 2.10.8에서 그 함수는 deprecated이고, `getAnonymousKey`의 반환
타입에서 `'INVALID_CATEGORY'`가 빠져 카테고리 제한이 풀렸다. SDK를 따른다.

**지급 이력 표에는 `auth.users` cascade를 걸지 말 것.** 지금 `toss_anon_keys`는 계정이
지워지면 함께 사라진다(`delete_my_account()` → `auth.users` 삭제 → cascade). 확인용
기록이라 그게 맞지만, 지급 이력이 같은 식으로 사라지면 **탈퇴 후 재진입으로 다시 받을 수
있다.** 이력은 계정이 아니라 식별키에 묶어 계정과 무관하게 남겨야 한다.

### 미리 알아 둘 함정

- **혜택 탭 노출 여부는 나중에 못 바꾼다.** 미노출로 등록하면 새 프로모션을 만들어야 한다 —
  유입이 목적이면 처음부터 노출로 등록할 것
- **혜택 탭 카드에는 금액이 하나만 뜬다.** 20원으로 띄우면 매력이 없고 100원으로 띄우면 첫
  지급이 20원이라 어긋난다. 콘솔이 프로모션 이름을 "구체적으로" 쓰라고 하니 이름에 단계를
  다 박을 것 — `접속 20원 + 1판 30원 + 3판 50원 (최대 100원)`
- 혜택 탭의 `고정 금액`이 SDK의 `amount`를 강제하는지는 문서에 없다. 노출로 갈 거면
  검수 문의로 확인할 것
- 미션 이름은 `~하기`로 끝나야 한다. "접속하기"는 어색하니 "게임 시작하기"가 낫다.
  이동 URL은 `intoss://minigame30/ScreenName` 형식이라 라우터가 그 스킴을 받는지 확인이 필요하다
- 1인 5,000포인트 이하. 사전 검수 영업일 2~3일, 포인트 지급 API 테스트 1회 필수
- `TEST_{promotionCode}`를 쓰면 예산을 안 쓰고 검증할 수 있다
- 지급 방식은 **고정 금액**만. 게임 앱은 확률형이 전면 불가라 `최대 금액`(랜덤)을 고르면 안 된다
- 사용자에게 지급 시점·조건·제한과 **"본 프로모션은 사전 고지 없이 중단될 수 있습니다"**를
  고지해야 한다

**토스 로그인은 선행 조건이 아니다.** 접속 보상을 `getAnonymousKey()`로 묶으면 로그인 없이
1인 1회가 잠긴다.

### 콘솔에 등록된 것 (2026-08-06 승인)

| 항목 | 값 |
| --- | --- |
| 이름 | 접속시 20원, 게임 하고 80원더 받아가세요 |
| 미션 이름 | 서비스 이용하기 |
| 혜택 탭 지급 금액 | 100원 |
| 이동 URL | `intoss://minigame30` |
| 전체 예산 | 100,000원 |
| 1인 하루 최대 | 100원 |

코드는 `.env.toss`의 `VITE_TOSS_PROMOTION_CODE`에 있다. 테스트 코드는 같은 값 앞에
`TEST_`가 붙은 것이고, 빌드할 때 환경 변수로 덮어쓴다.

### 구현

| 조각 | 자리 |
| --- | --- |
| 단계 정의(금액·조건) | `promotion_stages()` — SQL 한 곳에만 둔다 |
| 판정 | `next_promotion_stage()` — 받을 수 있는 단계 하나를 돌려준다 |
| 기록 | `record_promotion_grant()` — 지급에 성공한 뒤에만 부른다 |
| 지급 | `src/shared/tossPromotion.ts` |
| 부르는 곳 | 접속 = `main.ts`, 판 종료 = `gameContext.submitScore` |
| 진행 상황 조회 | `my_promotion_status()` → `promotionStatus` ref |
| 종료 판정 | `promotion_state` 표 + `promotion_ended()` |
| 고지 화면 | `src/pages/EventPage.vue` (`/event`), 홈 배너가 입구 |

**전부 미니앱 빌드에서만 돈다.** `isInToss`가 빌드 때 정해지는 상수라 웹·안드로이드
번들에는 지급 코드도 `EventPage`도 `/event` 라우트도 실리지 않는다 (빌드 후 `grep`으로
확인함). 홈 배너 문구만 웹 번들에 남는데, 상태가 채워질 일이 없어서 그려지지는 않는다 —
그래도 배너 조건에서 `isInToss`를 한 번 더 본다.

고지 문구는 약관·개인정보처리방침과 같은 이유로 한국어로만 쓴다. 앱인토스는 한국
서비스이고, 고지를 임의 번역하면 효력이 문제될 수 있다.

**금액도 조건도 클라이언트가 정하지 않는다.** 서버가 정해 준 금액을 SDK에 그대로 넘길
뿐이다. 식별키도 넘기지 않는다 — 넘기면 남의 키로 부를 수 있어서 서버가 `auth.uid()`로 찾는다.

**판 수는 접속 보상을 받은 뒤로만 센다.** 처음에는 `scores` 전체를 셌는데, 그러면
프로모션 전에 이미 3판 넘게 한 사람은 2·3단계가 처음부터 충족돼 있어서 **게임을 하지 않고
앱을 껐다 켜기만 해도 접속할 때마다 한 단계씩 나갔다.** 실기기 테스트에서 세 번 접속으로
100원이 다 지급된 것을 확인하고 고쳤다. 기준점은 1단계를 받은 시각이고, 1단계는 조건이
없어 가장 먼저 나가므로 2·3단계를 따질 때는 항상 존재한다.

**끝난 것을 앱이 알아야 한다.** 예산이 소진되거나 종료일이 지나도 앱은 그걸 알 길이
없어서, 홈 배너는 계속 '80원 더 받을 수 있어요'를, 안내 화면은 '조건을 채우면 바로
지급됩니다'를 띄웠다. 시키는 대로 게임을 해도 아무것도 들어오지 않는다. 그래서
`promotion_state`에 스위치를 두고, `my_promotion_status()`가 `ended`를 함께 돌려준다.
끝난 뒤에는 `next_promotion_stage()`가 단계를 내주지 않아 지급 시도 자체가 멈춘다.

**끄는 방법은 둘, 둘 다 재배포가 필요 없다.**

| 언제 | 어디 | 방법 |
| --- | --- | --- |
| 예정된 종료 | `ends_at` | 콘솔 종료일을 넣어두면 그 시각에 저절로 꺼진다 |
| 즉시 중단 | `ended_at` | 예산 소진·긴급 중단 때 사람이 켠다 |

```sql
-- 즉시 끄기
update promotion_state set ended_at = now(), ended_code = '예산 소진';
-- 되살리기 (무엇으로 꺼졌는지 모르면 둘 다 지운다)
update promotion_state set ended_at = null, ended_code = null, ends_at = null;
```

**거절 코드로 자동 판정하지 않는다.** 처음에는 `record_promotion_failure()`가 `4112`
(예산 부족)·`4105`(종료)·`4109`(실행중 아님)를 받으면 스스로 끄게 했는데, 두 가지가
틀렸다. **`p_code`는 클라이언트가 넘기는 문자열이고 이 앱은 익명 로그인을 쓴다** — 번들의
anon key만 있으면 누구나 `authenticated`가 되므로 그 판정은 아무나 누를 수 있는 전역
킬스위치였다. 그리고 `4112`·`4109`는 충전하거나 재개하면 풀리는 일시 상태인데, 한 번
박힌 `ended_at`은 사람이 지우기 전까지 남아 예산을 채워도 지급이 재개되지 않았다.
자동 판정이 벌어주는 것(예산 소진을 스스로 알아채기)은 콘솔 잔액과 `promotion_failures`에
쌓이는 `4112`로도 드러난다 — 값이 비용을 못 넘는다. `20260806700000`에서 걷어냈다.

끝난 뒤에도 홈 배너는 남는다 — **"왜 안 들어오냐"가 가장 많이 몰리는 때가 끝난 직후**라,
고지 화면으로 가는 입구를 그때 없애면 물어볼 곳이 사라진다. 문구만 '이벤트가 끝났어요 /
받은 포인트는 토스 혜택 탭에서 볼 수 있어요'로 바뀌고, 다 받은 사람은 헤드라인이 그대로다
(다 받았다는 사실은 끝나도 변하지 않는다). 고지 문구 자체는 상태에 따라 바꾸지 않는다 —
검수 때 어느 버전을 본 것인지 흐려진다.

**운영 적용 현황 (2026-08-06).** `20260806600000`·`20260806700000`을 운영 Supabase에
넣었고 `ends_at`은 `2026-08-31 14:59:00+00`(한국시간 8/31 23:59, 콘솔 종료일과 같다)이다.
`ended_at`은 비어 있고, 킬스위치가 사라진 것도 확인했다
(`select prosrc like '%promotion_state%' from pg_proc where proname = 'record_promotion_failure'` → `false`).
**콘솔에서 종료일을 늘리면 `ends_at`도 같이 미뤄야 한다** — 콘솔만 고치면 서버가 단계를
내주지 않아 아무도 못 받는다. 화면 문구는 `ended`를 읽는 빌드가 검토를 통과한 뒤부터
바뀐다. SQL만 먼저 들어간 동안에는 예전 빌드가 늘어난 컬럼을 무시하므로 달라지는 것이 없다.

### 운영 중에 쓰는 쿼리

예산이 예정보다 빨리 소진되거나 급히 손봐야 할 때 쓴다. 전부 Supabase SQL 편집기에서
그대로 돌아간다.

**지금 상태 한눈에** — 무슨 일이 벌어지고 있는지 여기서 시작한다.

```sql
select
  promotion_ended()                                        as 끝났나,
  (select ends_at from promotion_state)                    as 종료예정,
  (select ended_at from promotion_state)                   as 중단시각,
  (select ended_code from promotion_state)                 as 중단사유,
  (select coalesce(sum(amount), 0) from promotion_grants)  as 지급총액,
  (select count(distinct anon_key) from promotion_grants)  as 참여자,
  (select count(*) from promotion_grants where stage = 3)  as 완주자;
```

전체 예산은 100,000원이다. **지급총액이 여기 가까워지면 소진이 임박한 것**이고, 1인 100원
이라 완주자 1,000명이 상한이다.

**예산이 바닥났는지** — 소진되면 `4112`가 쌓이기 시작한다. 이게 보이면 이미 거절당하는
사람이 있다는 뜻이다.

```sql
select code, count(*) as 사람, sum(attempts) as 시도, max(last_at) as 마지막
from promotion_failures
group by code
order by 마지막 desc;
```

**즉시 중단** — 예산이 소진됐거나 급히 멈춰야 할 때. 재배포가 필요 없고, 다음 실행부터
지급 시도가 멈추고 화면이 '이벤트가 끝났어요'로 바뀐다.

```sql
update promotion_state set ended_at = now(), ended_code = '예산 소진';
```

**되살리기** — 충전했거나 잘못 껐을 때. 무엇으로 꺼졌는지 모르면 셋 다 지우면 확실하다
(`ends_at`을 지우면 예정 종료도 함께 풀리니, 종료일을 유지하려면 앞의 둘만 지울 것).

```sql
update promotion_state set ended_at = null, ended_code = null;
```

**종료일 연장** — 콘솔에서 연장했다면 반드시 여기도 같이 미룬다.

```sql
update promotion_state set ends_at = '2026-09-30 23:59+09';
```

**지급이 먼저, 기록이 나중이다.** 그 사이에 연결이 끊기면 같은 단계를 한 번 더 받을 수
있다. 창이 짧아 이 순서를 택했다 — 반대로 하면 토스앱 버전이 낮아 지급이 실패한 사람이
업데이트한 뒤에도 영영 못 받는다. 하루 한도는 이걸 막지 못한다(재시도가 다음 날로 넘어갈
뿐이라 총액이 130원이 될 수 있다). 확률이 낮고 손해가 30원 단위라 그대로 둔다.

**'1인 하루 최대 금액'과 총액 보장은 다른 것이다.** 한 사람이 100원까지만 받는 것을
보장하는 건 `promotion_grants`이고, 하루 한도는 **그 로직이 뚫렸을 때를 위한 백스톱**이라
평상시에는 아무 일도 하지 않는다. 그래서 하루 한도를 올려도 다 받은 사람이 다음 날 또
받지는 않는다 — 내줄 단계가 없어서 지급을 시도조차 안 한다.

**같은 계정으로 두 번 테스트할 수 없다.** `promotion_grants`를 비워 우리 쪽 기억을 지워도
**`4110`(리워드를 지급/회수할 수 없어요)**이 뜬다. 토스가 1인당 지급 총액을 따로 세는
것으로 보인다 — 콘솔에서 '1인 하루 최대 금액'을 300원으로 올려도 그대로였으니 하루 한도는
아니다. 혜택 탭의 '지급 금액 100원'이 1인당 상한일 가능성이 높지만 확인하지는 못했다.

우리 설계도 1인 100원이라 운영에는 문제가 없다. 막히는 건 재테스트뿐이고, 다른 토스
계정을 쓰거나 프로모션을 새로 등록하는 수밖에 없다. 한도를 올려서 테스트했다면 **반드시
100원으로 되돌릴 것.**

**단계 판정이 틀려도 돈이 더 새지는 않는다.** 1인 100원 상한은 `promotion_grants`가 잡기
때문에, 판정 버그의 결과는 "예산 폭발"이 아니라 "게임을 안 해도 받아감"이다. 운영 중
확인은 아래 쿼리로 한다 — 2·3단계를 받은 사람의 `granted_at` 전후로 `scores`가 있는지 본다.

```sql
select g.anon_key, g.stage, g.granted_at,
       (select count(*) from scores s
        join toss_anon_keys t on t.user_id = s.user_id
        where t.anon_key = g.anon_key and s.created_at >= g.granted_at - interval '1 day') as plays
from promotion_grants g where g.stage >= 2
order by g.granted_at desc limit 20;
```

**미니앱은 접속하자마자 계정을 만든다.** 웹은 게임에 들어가야 만들지만(`main.ts` 주석),
접속 보상을 주려면 이력을 남길 계정이 있어야 한다. 접속 보상을 받은 사람은 열어만 보고
나간 방문자가 아니라서 이 예외가 성립한다.

### 남은 것

