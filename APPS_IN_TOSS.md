# 앱인토스 (토스 미니앱)

웹 게임을 토스 앱 안의 미니앱으로 내보내는 방법과 콘솔 설정을 적어 둔다.
안드로이드(Play) 쪽은 `ANDROID_RELEASE.md` / `PLAY_CONSOLE.md`에 있다.

**TWA와 결정적으로 다른 점:** TWA는 배포된 사이트를 껍데기로 띄우므로 웹만 고치면
앱이 따라왔다. 앱인토스는 **웹 자산을 번들 안에 통째로 넣어 올린다.** 사이트를 고쳐도
자동 반영되지 않고, 매번 다시 빌드해서 새 버전을 등록해야 한다.

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

---

## granite.config.ts

| 키 | 값 | 이유 |
| --- | --- | --- |
| `webViewProps.type` | `'game'` | **이 값이 `'game'`이어야 게임 미니앱으로 빌드된다.** 비게임 웹뷰는 TDS(토스 디자인 시스템) 적용이 의무라, 아니면 지금 UI를 전부 갈아엎어야 한다 |
| `brand.icon` | Vercel의 512 아이콘 URL | 파일 업로드가 아니라 URL 참조다. **그 배포가 살아 있어야 한다** |
| `brand.primaryColor` | `#FFCA28` | 아이콘의 금색 "30"과 앱 팔레트에서 가장 많이 쓰인 앰버 |
| `brand.displayName` | `MiniGame30` | 토스 템플릿 주석은 **한글 이름**을 권한다. 검토에서 지적되면 `미니게임30` 등으로 바꿀 것 |
| `permissions` | `[]` | 카메라·위치·연락처 안 쓴다 |
| `web.commands.build` | `vue-tsc --noEmit && vite build` | `build:toss`가 이걸 돌린 뒤 결과를 묶는다 |
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

## 로그인 — 붙이지 않았다

**토스 로그인(`appLogin`)**: 인가 코드를 받아 **내 서버에서 mTLS로 교환**해야 한다.
지금은 정적 호스팅뿐이라 서버를 새로 세워야 하고, 콘솔 권한 설정과 로그인 검토
체크리스트도 따라온다. 비용 대비 얻는 게 없어 보류했다.

**`getAnonymousKey()`**: 이것도 안 붙였다. 웹뷰도 결국 브라우저라 **기존 Supabase 익명
로그인이 그대로 동작한다** — 실기기에서 점수와 랭킹이 정상 기록되는 것을 확인했다.
웹뷰 저장소가 비워져 계정이 날아가는 사례가 실제로 보고되면 그때 붙인다.

---

## 웹뷰에서만 나던 문제 (2026-07-30)

두 증상 모두 앱인토스 웹뷰와 사파리 '홈 화면에 추가' 양쪽에서 재현됐다.

**둘 다 1차 수정이 듣지 않아 두 번 고쳤다.** 웹뷰는 웹 표준대로만 움직이지 않는다는 게
이번에 얻은 교훈이다.

### 더블탭하면 화면이 밀리고 반대쪽이 잘림

처음엔 브라우저 기본 **더블탭 확대**로 봤다. 게임 캔버스는 `stage.ts`에서 이미
`touch-action:none`이라, 범인은 점수바·하단바 같은 **바깥 HTML**이라고 생각했다.
**이 진단은 틀렸다** — 아래 두 번의 실패가 그것을 보여준다.

| 시도 | 결과 |
| --- | --- |
| `body`에 `touch-action: manipulation` | ❌ 그대로 재현 |
| `*`에 `touch-action: manipulation` + viewport에 `user-scalable=no` | ❌ 그대로 재현 |

**둘 다 실패했다 = 더블탭 확대가 원인이 아니다.** 확대를 두 겹으로 막았는데도 화면이
움직인다면 남는 것은 **스크롤**이다.

#### 범위 (2차 수정 후 다시 재봄)

| 환경 | 재현 |
| --- | --- |
| 모바일 브라우저 | 없음 (원래부터 멀쩡했다) |
| iOS '홈 화면에 추가' | **재현** |
| 앱인토스 웹뷰 | **미확인** — 아래 참고 |

> ⚠️ **여기서 한 번 헛다리를 짚었다.**
> `main`에 머지하고 웹 배포를 했으니 앱인토스도 최신이라고 착각했다.
> **미니앱은 웹 자산을 번들 안에 넣어 배포하므로 웹 배포로는 절대 안 바뀐다.**
> 앱인토스에서 뭔가를 확인할 때는 **반드시 `npm run build:toss`로 다시 빌드해
> 새 버전을 등록한 뒤** 그 QR로 볼 것.

iOS standalone에서 남는 것은 확실하다. 주 배포처인 Play는 TWA(크롬 엔진)라 영향이 없고,
앱인토스는 재빌드 후 다시 봐야 한다. 그때까지 **원인 규명은 보류한다.**

알려진 해법은 **스크롤을 `body`에서 안쪽 컨테이너로 옮기는 것**인데
(`html,body`를 `overflow:hidden`으로 고정하고 `#app`에 스크롤을 준다)
모든 화면의 스크롤 구조를 건드리므로 실기기를 붙잡고 할 일이다.

#### 유력한 가설 (다음에 여기서부터 시작할 것)

> 페이지가 화면보다 조금 크다.

`.app-shell`은 `min-height: 100dvh`인데 `html/body/#app`은 `height: 100%`다.
웹뷰에서 `100dvh`가 `100%`보다 크게 잡히면 그 차이만큼 페이지가 세로로 스크롤된다.
"폰 사이즈보다 화면이 크다"는 관찰과 정확히 맞물린다.

제일 먼저 할 일은 **정말 스크롤되는지 재는 것**이다. 재현되는 기기에서:

```js
document.documentElement.scrollHeight - window.innerHeight  // 0보다 크면 스크롤된다
```

0보다 크면 `100dvh`/`100%`/`env(safe-area-inset-*)`의 조합을 손볼 문제이고,
0이면 스크롤도 아니므로 원인을 처음부터 다시 잡아야 한다.

원인이 밝혀지면 **`user-scalable=no`를 되돌릴지도 같이 판단할 것.** 효과가 없는 것으로
드러났는데, 웹뷰와 '홈 화면에 추가' 창에서 핀치 확대를 막는 대가는 그대로 치르고 있다.

### 게임 카드를 길게 누르면 링크 주소가 뜸

카드가 `RouterLink`(= `<a>`)였다.

| 시도 | 결과 |
| --- | --- |
| `-webkit-touch-callout: none` (body, 원래 있던 것) | ❌ iOS 전용이라 안드로이드 웹뷰에서 안 먹는다 |
| `contextmenu` 기본동작 차단 (`main.ts`) | ❌ 그대로 재현. **웹뷰가 롱프레스를 웹 이벤트로 넘기지 않고 네이티브에서 처리**하는 것으로 보인다 |
| `GameCard`를 `<button>` + `router.push()`로 교체 | 검증 대기 |

허브 카드만 바꿨다. 다른 화면의 `RouterLink`에서도 같은 증상이 나면 그때 넓힌다.

웹에서 손댈 수 있는 게 없으면 **링크를 없애는 수밖에 없다.**
새 탭으로 열기를 잃지만 모바일 전용 화면이라 쓸 일이 없다.
`contextmenu` 차단은 글자 선택 팝업에는 여전히 쓸모가 있어 남겨 뒀다.

### 소셜 로그인 창을 닫고 돌아오면 버튼이 잠김

온보딩에서 구글/카카오를 누른 뒤 **로그인하지 않고 창만 닫으면** 모든 버튼이 비활성으로
남아 `아니요, 처음이에요`까지 눌리지 않는다. 온보딩을 아예 빠져나갈 수 없는 상태가 된다.

브라우저는 리다이렉트로 페이지가 통째로 다시 떠서 `busy`가 자연히 풀리지만,
웹뷰·인앱브라우저는 로그인 창을 위에 얹었다 치울 뿐이라 화면이 그대로 살아남는다.
`visibilitychange`로 돌아온 것을 감지해 푼다 (`OnboardingFlow.vue`).

✅ **실기기에서 해결 확인.**

재현하려면 온보딩 화면을 다시 띄워야 하는데, `localStorage`의 `webgame:onboarded`가
남아 있으면 안 뜬다. 브라우저 시크릿 창이 제일 빠르다.

### 검증 현황

| 증상 | 상태 |
| --- | --- |
| 소셜 로그인 취소 시 버튼 잠김 | ✅ 해결 |
| 게임 카드 롱프레스 시 주소 노출 | 검증 대기 (재빌드한 번들로 볼 것) |
| 더블탭 시 화면 밀림 | ❌ iOS 홈화면에서 재현. 앱인토스는 재빌드 후 재확인 필요 |

---

## 현재 상태

- [x] 빌드 환경 — `granite.config.ts`, `:toss` 스크립트, `.gitignore`
- [x] MCP 연결 (문서 + 콘솔)
- [x] 콘솔 미니앱 생성, 첫 번들 등록 (`20260730-1`, 상태: 검토 필요)
- [ ] 웹뷰 버그 수정분 재빌드 → 새 버전 등록
- [ ] 콘솔 앱 정보 — 아이콘, 스크린샷, 설명, 검색 키워드
- [ ] 검토 요청
- [ ] 인앱광고

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
