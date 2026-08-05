# 앱인토스 (토스 미니앱)

웹 게임을 토스 앱 안의 미니앱으로 내보내는 방법과 콘솔 설정을 적어 둔다.
안드로이드(Play) 쪽은 `ANDROID_RELEASE.md` / `PLAY_CONSOLE.md`에 있다.

**웹 배포와 다른 점:** 앱인토스는 **웹 자산을 번들 안에 통째로 넣어 올린다.**
사이트를 고쳐도 자동 반영되지 않고, 매번 다시 빌드해서 새 버전을 등록해야 한다.
안드로이드(Capacitor) 쪽도 지금은 같은 방식이다.

| 항목 | 값 |
| --- | --- |
| appName | `minigame30` |
| 표시 이름 | `MiniGame30` |
| 카테고리 | 게임 |
| SDK | `@apps-in-toss/web-framework` 2.10.8 |
| 설정 파일 | `granite.config.ts` |
| 콘솔 | https://apps-in-toss.toss.im |

---

## 다음 버전 올릴 때 (평소에 보는 곳)

```bash
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

---

## 아직 안 붙인 것

**연결 끊기 콜백**: 사용자가 토스 앱에서 연결을 끊으면(설정 → 인증 및 보안 →
토스로 로그인한 서비스) 등록한 URL로 알려 준다. 동의 항목이 이름·이메일·성별 안에
있으면 등록이 의무는 아니라서 미뤘다. 지금은 연결을 끊어도 앱이 로그인 상태로 남는다.

**`getAnonymousKey()`**: 안 붙였다. 웹뷰도 결국 브라우저라 **기존 Supabase 익명
로그인이 그대로 동작한다** — 실기기에서 점수와 랭킹이 정상 기록되는 것을 확인했다.
토스 로그인이 들어온 지금은 계정 복구 경로가 생겨서 우선순위가 더 내려갔다.

---

## 현재 상태

- [x] 빌드 환경 — `granite.config.ts`, `:toss` 스크립트, `.gitignore`
- [x] MCP 연결 (문서 + 콘솔)
- [x] 콘솔 미니앱 생성, 첫 번들 등록 (`20260730-1`, 상태: 검토 필요)
- [x] 웹뷰 전용 버그 3건 수정 후 재빌드 → 실기기 확인 완료
- [x] 앱 승인
- [x] 토스 로그인 — 코드 작성 완료 (아래 미확인 항목 남음)
- [x] 인앱광고 — 코드 작성 완료 (광고 그룹 ID 발급과 실기기 확인이 남았다)
- [ ] 콘솔 앱 정보 — 아이콘, 스크린샷, 설명, 검색 키워드
- [ ] 검토 요청

토스 로그인은 **실기기에서 한 번도 돌려보지 않았다.** 확인해야 할 것:

- 콘솔 설정 (약관 동의, 동의 항목, 약관 링크)
- Vercel 환경 변수 4개 + Supabase Email provider 활성화
- 마이그레이션 적용
- 미니앱에서 로그인 → 랭킹 기록이 유지되는지
- 다른 기기에서 로그인 → 그 기록이 따라오는지

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
- [ ] **구글 반영 대기.** 등록까지 최대 2시간이고, 그 전에는 로드가 실패한다.
      반영이 끝나면 콘솔이 광고 그룹 ID를 알려준다
- [ ] 받은 ID를 `.env.toss`의 `VITE_TOSS_AD_GROUP_ID`에 넣기. **비어 있으면 스텁으로
      떨어진다** — 실수로 AdSense가 나가는 일은 없지만, 광고도 안 나간다
- [ ] **테스트 ID로 빌드해 실기기에서 확인** (위 '테스트' 참고). 샌드박스로는 안 되고
      콘솔 QR로 받아야 한다. 게임오버 → 이어하기 버튼
