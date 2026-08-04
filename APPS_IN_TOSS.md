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
| `brand.displayName` | `MiniGame30` | 토스 템플릿 주석은 **한글 이름**을 권한다. 검토에서 지적되면 `미니게임30` 등으로 바꿀 것 |
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
| `SUPABASE_URL` | 프론트의 `VITE_SUPABASE_URL`과 같은 값 |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role 키.** 절대 프론트에 넣지 않는다 |

인증서 파일은 저장소에 두지 않는다 (`.gitignore`에 `*.key`, `*.crt`, `*.pem`, `*.p12`).
유효기간은 발급일로부터 약 1년이라 만료 전에 콘솔에서 재발급해야 한다.

Supabase 대시보드:

- Authentication → Providers → **Email 활성화.** 메일을 보내지는 않지만, 세션 발급에
  쓰는 `generateLink`가 이 provider를 탄다
- `supabase/migrations/20260804100000_toss_login.sql` 적용

앱인토스 콘솔 (`toss-docs/login-intro.md`):

- 토스 로그인 약관 동의 (대표 관리자 계정만 가능)
- **동의 항목(scope)** — 개인정보는 받지 않는 쪽으로 잡았다. `userKey`만 있으면 계정
  식별이 되고, 이름을 받으면 랭킹에 실명이 뜰 위험이 생긴다. 이름·이메일·성별 외의
  항목을 고르면 연결 끊기 콜백 등록이 의무가 된다
- 약관 등록 — `/terms`, `/privacy` 주소를 넣는다
- 복호화 키는 개인정보 필드를 받을 때만 쓴다. 지금 설계에서는 쓰지 않는다

---

## 아직 안 붙인 것

**연결 끊기 콜백**: 사용자가 토스 앱에서 연결을 끊으면(설정 → 인증 및 보안 →
토스로 로그인한 서비스) 등록한 URL로 알려 준다. 개인정보 항목을 받지 않으면 등록이
의무는 아니지만, 지금은 연결을 끊어도 앱이 로그인 상태로 남는다.

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
- [ ] 콘솔 앱 정보 — 아이콘, 스크린샷, 설명, 검색 키워드
- [ ] 검토 요청
- [ ] 인앱광고

토스 로그인은 **실기기에서 한 번도 돌려보지 않았다.** 확인해야 할 것:

- 콘솔 설정 (약관 동의, 동의 항목, 약관 링크)
- Vercel 환경 변수 4개 + Supabase Email provider 활성화
- 마이그레이션 적용
- 미니앱에서 로그인 → 랭킹 기록이 유지되는지
- 다른 기기에서 로그인 → 그 기록이 따라오는지

---

## 다음: 인앱광고

SDK에 광고 API가 이미 들어 있다. `@apps-in-toss/web-framework`에서 그대로 import한다.

| API | 용도 |
| --- | --- |
| `loadFullScreenAd` / `showFullScreenAd` | 전면·보상형 광고 |
| `attachBanner(adGroupId, target, options)` | 배너 |
| `TossAds` / `GoogleAdMob` | 제공자별 진입점 |

지금 웹은 AdSense(H5 Games Ads)를 쓴다 — `src/shared/ads.ts`의 `AdProvider` 인터페이스와
`VITE_ADSENSE_CLIENT` 환경변수. 매체를 갈아끼우도록 이미 추상화돼 있으므로,
**앱인토스용 `AdProvider` 구현을 하나 더 만들어 환경에 따라 고르는 방식**이 자연스럽다.

시작 전에 확인할 것:

- 콘솔에서 인앱광고를 **먼저 신청·승인**받아야 하는지
- `adGroupId`를 콘솔 어디서 발급받는지
- 웹뷰 안에서 AdSense를 그대로 두면 정책 위반인지 (토스 심사 기준 확인 필요)
