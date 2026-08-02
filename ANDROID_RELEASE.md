# 안드로이드 빌드 (Capacitor)

웹 빌드를 안드로이드 앱 안에 넣어 `.aab`를 뽑는 방법.
Play Console 쪽 설정은 `PLAY_CONSOLE.md`에 있다.

**TWA에서 Capacitor로 갈아탔다.** TWA는 배포된 웹사이트를 크롬으로 띄우는 방식이라
앱을 켜도 크롬이 실행됐고, 게임을 고치면 앱 업데이트 없이 바로 반영됐다.
Capacitor는 `dist/`를 앱 안에 통째로 넣고 앱 자신의 웹뷰로 띄운다.
크롬이 뜨지 않고 오프라인에서도 게임이 돌지만, **게임을 고치면 앱을 다시 올려야 한다.**

| 항목 | 값 |
| --- | --- |
| 웹 배포 주소 | `https://web-game-ecru.vercel.app` |
| 패키지 이름 | `com.minigame30.app` |
| 안드로이드 프로젝트 | 저장소 안 `android/` |
| 서명 키 | TWA 때 쓰던 `android.keystore` 그대로 |

> **패키지 이름과 서명 키는 TWA 때와 같아야 한다.** 달라지면 기존 앱을 업데이트할 수 없고
> 12명/14일 카운터도 처음부터 다시 돈다.

웹 배포(Vercel)는 그대로 유지한다. 개인정보처리방침·계정 삭제 페이지가 거기 있고,
앱인토스도 같은 코드를 쓴다.

---

## 다음 버전 올릴 때 (평소에 보는 곳)

게임을 고쳤으면 **웹 배포와 앱 빌드를 둘 다** 해야 한다. TWA와 달라진 부분이다.

`android/app/build.gradle`에서 두 값을 올린다. `versionCode`는 반드시 이전보다 커야 한다.

```gradle
versionCode 8
versionName "8"
```

```powershell
npm run build:android
cd android
.\gradlew.bat bundleRelease
```

`android\app\build\outputs\bundle\release\app-release.aab`를 Play Console에 올린다.

폰에 바로 설치해 확인하는 것은 `ANDROID_DEBUG.md`의 '설치까지 한 번에'를 따른다.

> `npm run build:android`은 `vite build` + `cap sync android`다.
> 이걸 건너뛰고 gradle만 돌리면 **앱 안에 예전 웹 빌드가 그대로 들어간다.**

---

## 업데이트 안내 팝업

새 버전을 올리면 사용자가 앱을 열 때 Play가 '나중에 / 업데이트' 다이얼로그를 띄운다.
`@capawesome/capacitor-app-update` + `src/shared/appUpdate.ts`.

**따로 관리할 값이 없다.** 최신 버전이 무엇인지는 Play가 알고 있으므로, 릴리스할 때
`versionCode`만 올리면 된다. 앱이나 DB에 최신 버전을 적어두는 방식이 아니다.

권유 방식(flexible)이다. 받겠다고 하면 게임을 하는 동안 뒤에서 내려받고, **다 받은
것은 다음에 앱을 열 때 설치한다.** 게임 도중에 앱이 다시 시작되면 그 판이 날아가기
때문이다. '나중에'를 누르면 24시간 동안 다시 묻지 않는다.

알아둘 것:

- **Play에서 설치한 앱에서만 동작한다.** 로컬 빌드나 사이드로드한 apk에서는 조용히
  넘어간다(오류로 죽지 않는다). 확인하려면 Play Console → 테스트 → **내부 앱 공유**로
  두 버전을 올리고, 낮은 쪽을 설치한 기기에서 앱을 열어 본다.
- **이 코드가 담긴 버전이 먼저 깔려 있어야 한다.** v4에 이 코드를 넣어 올리면, 팝업을
  실제로 보는 것은 v5부터다. v3을 쓰는 사람에게는 v4 안내가 뜨지 않는다.
- 웹과 앱인토스에서는 아무 일도 하지 않는다. 그쪽은 배포하면 다음 접속에 반영된다.

## 최초 1회 세팅

1. **JDK 21** — [Adoptium Temurin 21](https://adoptium.net/temurin/releases/?version=21).
   Capacitor 8이 요구하는 버전이다. TWA 때 쓰던 JDK 17로는 빌드가 안 된다.
   설치 화면의 **"Set JAVA_HOME variable"을 직접 켜야 한다** — 기본으로 꺼져 있다.
   17을 지울 필요는 없고 나란히 깔린다

설치한 뒤 **새 터미널**에서 확인한다. 열어 둔 창은 예전 값을 그대로 들고 있다.

```powershell
java -version        # 21.x
echo $env:JAVA_HOME  # ...\jdk-21...
```

`JAVA_HOME`이 비었거나 17을 가리키면 `gradlew.bat`이 17로 돌아 빌드가 깨진다. 직접 잡으려면:

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-21...', 'User')
```

다른 프로젝트 때문에 JAVA_HOME을 17로 둬야 한다면, 대신
`%USERPROFILE%\.gradle\gradle.properties`에 `org.gradle.java.home=...jdk-21...`을 넣으면
이 프로젝트만 21로 간다. 저장소 안의 `android/gradle.properties`는 커밋되는 파일이니
내 PC 경로를 넣지 말 것.

Android Studio로 빌드한다면 Studio가 들고 다니는 JDK를 쓰므로 위 설정과 무관하다.
`File → Settings → Build, Execution, Deployment → Build Tools → Gradle`의 Gradle JDK가 21이면 된다.
2. **Android SDK** — 기존 `C:\Android\Sdk`를 그대로 쓴다. `platforms;android-36`이 필요하다

```powershell
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-36"
```

3. **SDK 경로 알려주기** — `android/local.properties`를 만든다 (gitignore되어 있다)

```powershell
echo sdk.dir=C:/Android/Sdk > android\local.properties
```

4. **서명 키 연결** — `android/keystore.properties.example`을 `keystore.properties`로
   복사하고 실제 경로·비밀번호를 넣는다. 이 파일과 keystore는 gitignore되어 있다

파일이 없으면 서명 없이 빌드된다. 디버그 빌드는 그래도 돌아가지만
**Play에 올릴 `bundleRelease`는 이 파일이 있어야 한다.**

### 서명 키 — 제일 중요

> **`android.keystore`와 비밀번호 두 개를 잃어버리면 앱을 영원히 업데이트할 수 없다.**
> 같은 패키지 이름으로 새로 올리는 것도 안 된다.

파일은 클라우드 + USB 등 최소 두 군데, 비밀번호는 비밀번호 관리자에.
`.gitignore`에 있더라도 **절대 커밋하지 말 것.**

---

## 소셜 로그인 — 앱에서만 다른 부분

구글은 앱 웹뷰 안에서 도는 OAuth를 거부한다(`disallowed_useragent`).
그래서 앱에서는 로그인 창을 **크롬 커스텀 탭**으로 띄우고, 끝나면 딥링크로 앱에 돌아온다.
카카오도 웹뷰 안에서는 '카카오톡으로 로그인'을 쓸 수 없어 같이 해결된다.

TWA는 그 자체가 크롬이라 이 문제가 없었다. 앱에서 로그인이 안 되면 여기부터 본다.

| 곳 | 넣을 값 |
| --- | --- |
| Supabase → Authentication → URL Configuration → Redirect URLs | `com.minigame30.app://auth-callback` |
| `android/app/src/main/res/values/strings.xml` | `custom_url_scheme` = `com.minigame30.app` |
| `src/shared/native.ts` | `AUTH_CALLBACK` |

셋 중 하나만 달라도 로그인 창이 닫힌 뒤 아무 일도 일어나지 않는다.

---

## 광고 — AdMob

앱에서는 AdSense(H5 Games Ads)를 쓸 수 없다. AdSense는 웹사이트용 상품이라
앱 웹뷰에서 게재하면 프로그램 정책 위반이고 게시자 계정이 제재 대상이 된다.
웹과 앱인토스는 지금까지대로 AdSense, 안드로이드 앱만 AdMob으로 간다.

**지금은 광고가 꺼져 있다.** `VITE_ADMOB_REWARD_ID`가 비어 있으면 앱에 광고가 아예 없다 —
`NoAdProvider`라 이어하기·무르기 버튼조차 안 그려진다(`DESIGN.md`의 '리워드 광고' 참고).
테스트 단위를 넣으면 구글 테스트 광고가 뜬다. 매니페스트의 AdMob 앱 ID는
실제 값(`ca-app-pub-9942492825878908~7836378510`)으로 바꿔 두었다 — **앱 ID만으로는
광고가 나가지 않는다.** 실제 광고는 광고 단위 ID를 넣는 순간 시작된다.

### 광고를 실제로 켤 때

두 ID를 헷갈리지 말 것. 앞의 게시자 번호가 같아서 눈으로는 잘 안 갈린다.

| ID | 구분자 | 들어가는 곳 |
| --- | --- | --- |
| 앱 ID | 물결 `~` | `AndroidManifest.xml`의 `APPLICATION_ID` |
| 광고 단위 ID | 슬래시 `/` | `.env.local`의 `VITE_ADMOB_REWARD_ID` |

앱 ID를 틀리면 앱이 바로 죽어서 금방 안다. **광고 단위 ID를 틀리면 조용히 실패한다** —
`ads.ts`가 로드 실패를 매체 사정으로 보고 보상을 그냥 주기 때문에, 광고는 영영 안 나오는데
에러도 없다. 넣은 뒤 `adb logcat -s Ads`로 요청이 나가는지 확인할 것.
관리자 화면 `/stats/ads`도 같이 본다 — 호출 결과가 `ad_views`에 남으므로 단위 ID가
틀리면 `못 뜸`만 쌓이는 것으로 드러난다(폰을 물리지 않아도 된다).

**배포는 두 번 나뉜다.** AdMob은 앱이 프로덕션으로 스토어에 올라가 있어야 스토어 연결을
받아주고, **스토어를 연결해야 광고 단위를 만들 수 있다**(2026-08 콘솔 기준 확인).
즉 광고 단위 ID는 첫 출시 전에는 존재하지 않는다.

| 차수 | 할 일 |
| --- | --- |
| **1차 배포** | `AD_ID`의 `tools:node="remove"` 블록 삭제 + Play Console '광고 ID 사용' → 예. 이 둘은 **반드시 세트**다 — 하나만 바꾸면 권한과 선언이 어긋나 차단된다. 데이터 보안·개인정보처리방침도 함께 갱신(`PLAY_CONSOLE.md`) |
| 스토어 등재 후 | AdMob에서 **스토어 추가** → **광고 단위 생성** → 검토 → 승인 |
| **2차 배포** | `.env.local`의 `VITE_ADMOB_REWARD_ID`를 발급받은 광고 단위 ID로 |

`AndroidManifest.xml`의 `APPLICATION_ID`는 이미 실제 앱 ID로 바꿔 두었다.

1차와 2차 사이에는 실제 광고가 나갈 수 없다. 그동안은 값을 비워 두면 되고, 그러면 광고
버튼 자체가 화면에 서지 않는다. 테스트 단위를 그대로 두면 "Test Ad" 라벨이 붙으므로
실사용자용 빌드에서는 비워 둔다.

`public/app-ads.txt`는 미리 올려 두었다 — 게시자 ID(`pub-9942492825878908`)를 적어
두는 파일이고, 구글이 크롤링해 가는 데 시간이 걸려 광고를 켜기 전에 있어야 한다.
AdMob 콘솔의 **앱 → app-ads.txt** 에서 인식 여부를 확인할 수 있다.

---

## assetlinks.json

TWA는 주소창을 없애려고 이 파일이 필요했다. Capacitor는 웹사이트를 띄우는 게 아니라
필요 없어졌지만, **지우지 않는다.** 빼서 얻는 게 없고 나중에 https 딥링크(App Links)를
쓰게 되면 그대로 필요하다. 지문도 손대지 않는다.

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
| --- | --- |
| `gradlew`가 `SDK location not found`로 죽음 | `android/local.properties`가 없다. `echo sdk.dir=C:/Android/Sdk > android\local.properties` (구분자는 `/`) |
| 빌드가 JDK 버전으로 죽음 | JDK 21이어야 한다. Android Studio의 `File → Settings → Build Tools → Gradle`에서 Gradle JDK 확인 |
| `cap sync`가 `dist must contain an index.html`로 죽음 | 웹 빌드가 없다. `dist`는 gitignore라 clone 직후엔 아예 없다. `cap sync`를 따로 부르지 말고 `npm run build:android` |
| 앱은 새로 깔았는데 게임이 예전 그대로 | `cap sync`를 안 했다. gradle 말고 `npm run build:android`부터 |
| 로그인 창이 닫히고 아무 일도 안 일어남 | 위 "소셜 로그인" 표의 세 값이 어긋났다. Supabase Redirect URLs부터 확인 |
| 광고 버튼을 누르면 앱이 죽음 | 매니페스트의 AdMob 앱 ID가 실제 값이 아니다 |
| 업로드 시 "이미 사용된 버전 코드" | `versionCode`를 더 큰 값으로 올리고 재빌드. Console에서는 못 고친다 |
| 업로드 시 서명 키 불일치 | `keystore.properties`가 TWA 때 쓰던 키를 가리키는지 확인 |
| 앱 이름·아이콘이 안 바뀜 | 매니페스트가 아니라 `android/app/src/main/res`를 본다. 아이콘은 `node tools/android-assets.mjs`로 다시 만든다 |


## 안드로이드 빌드시 (.aab 파일 생성)
bash 에서 확인 (프로젝트 경로)
npm run build
npx cap sync android

cmd에서
프로젝트 경로로 들어가서 (cd C:\Workspace\webGame\android)
gradlew.bat clean

아래 실행하기전에 버전올리기 (C:\Workspace\webGame\android\app - build.gradle)
gradlew.bat bundleRelease