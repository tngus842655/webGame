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
versionCode 11
versionName "1.2.0"
```

```powershell
npm run build:android
cd android
.\gradlew.bat bundleRelease
```

`android\app\build\outputs\bundle\release\app-release.aab`를 Play Console에 올린다.

폰에 바로 설치해 확인하려면:

```powershell
.\gradlew.bat assembleDebug
C:\Android\Sdk\platform-tools\adb.exe install -r app\build\outputs\apk\debug\app-debug.apk
```

> `npm run build:android`은 `vite build` + `cap sync android`다.
> 이걸 건너뛰고 gradle만 돌리면 **앱 안에 예전 웹 빌드가 그대로 들어간다.**

---

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

**지금은 구글이 공개한 테스트 ID가 박혀 있다.** 실제 광고를 켜려면 두 군데를 같이 바꾼다.

| 곳 | 값 |
| --- | --- |
| `android/app/src/main/AndroidManifest.xml`의 `APPLICATION_ID` | AdMob 앱 ID (`ca-app-pub-…~…`) |
| `.env.local`의 `VITE_ADMOB_REWARD_ID` | 리워드 광고 단위 ID (`ca-app-pub-…/…`) |

`VITE_ADMOB_REWARD_ID`가 비어 있으면 5초 카운트다운 스텁으로 떨어진다. 앱은 정상 동작한다.

> 실제 광고를 켜는 순간 AAB에 `AD_ID` 권한이 붙는다.
> Play Console의 '광고 ID 사용'을 **예**로 바꾸고 데이터 보안도 같이 갱신해야 한다.
> 안 바꾸면 권한과 답변이 어긋나 앱이 차단된다. `PLAY_CONSOLE.md` 참고.

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
| 앱은 새로 깔았는데 게임이 예전 그대로 | `cap sync`를 안 했다. gradle 말고 `npm run build:android`부터 |
| 로그인 창이 닫히고 아무 일도 안 일어남 | 위 "소셜 로그인" 표의 세 값이 어긋났다. Supabase Redirect URLs부터 확인 |
| 광고 버튼을 누르면 앱이 죽음 | 매니페스트의 AdMob 앱 ID가 실제 값이 아니다 |
| 업로드 시 "이미 사용된 버전 코드" | `versionCode`를 더 큰 값으로 올리고 재빌드. Console에서는 못 고친다 |
| 업로드 시 서명 키 불일치 | `keystore.properties`가 TWA 때 쓰던 키를 가리키는지 확인 |
| 앱 이름·아이콘이 안 바뀜 | 매니페스트가 아니라 `android/app/src/main/res`를 본다. 아이콘은 `node tools/android-assets.mjs`로 다시 만든다 |
