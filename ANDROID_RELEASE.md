# 안드로이드 빌드 (Bubblewrap TWA)

배포된 웹사이트를 안드로이드 앱 껍데기에 담아 `.aab`를 뽑는 방법.
Play Console 쪽 설정은 `PLAY_CONSOLE.md`에 있다.

TWA는 앱 안에 게임을 넣는 게 아니라 **배포된 웹사이트를 크롬 엔진으로 띄우는 방식**이다.
그래서 사이트가 죽으면 앱도 죽고, 게임을 고치면 앱 업데이트 없이 바로 반영된다.

| 항목 | 값 |
| --- | --- |
| 배포 주소 | `https://web-game-ecru.vercel.app` |
| 매니페스트 | `https://web-game-ecru.vercel.app/manifest.webmanifest` |
| 패키지 이름 | `com.minigame30.app` |
| 작업 폴더 | `C:\Workspace\MiniGame30-TWA` |
| Android SDK | `C:\Android\Sdk` |

> **패키지 이름은 한 번 출시하면 영영 못 바꾼다.**

---

## 다음 버전 올릴 때 (평소에 보는 곳)

게임 내용만 고쳤다면 **웹 배포만 하면 끝이다.** 앱 업데이트가 필요 없다.

앱 껍데기(아이콘, 이름, targetSdk 등)가 바뀌었을 때만 다시 빌드한다.
매니페스트를 읽어 가므로 **웹 배포가 먼저**다.

`twa-manifest.json`에서 두 값을 올린다. `appVersionCode`는 반드시 이전보다 커야 한다.

```json
"appVersionCode": 2,
"appVersionName": "1.1.0"
```

```powershell
cd C:\Workspace\MiniGame30-TWA
bubblewrap update
bubblewrap build
```

나온 `app-release-bundle.aab`를 Play Console에 올린다. **같은 keystore**를 써야 한다.

---

## 최초 1회 세팅

이미 `C:\Workspace\MiniGame30-TWA`가 있으면 건너뛴다. 프로젝트를 새로 팔 때만 필요하다.

1. **JDK 17** — [Adoptium Temurin 17](https://adoptium.net/temurin/releases/?version=17) 설치
2. **Bubblewrap** — `npm i -g @bubblewrap/cli`
3. **경로 물려주기** — 첫 실행 때 묻는다. 새로 받겠다고 하지 말고 기존 경로를 넣을 것

```powershell
bubblewrap updateConfig --jdkPath "C:\Program Files\Eclipse Adoptium\jdk-17.0.13-hotspot"
bubblewrap updateConfig --androidSdkPath "C:\Android\Sdk"
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat --licenses
```

4. **프로젝트 생성** — 저장소 **바깥에** 판다 (keystore가 git에 딸려 올라간다)

```powershell
mkdir C:\Workspace\MiniGame30-TWA
cd C:\Workspace\MiniGame30-TWA
bubblewrap init --manifest https://web-game-ecru.vercel.app/manifest.webmanifest
```

대화형으로 묻는 값 — 대부분 매니페스트에서 끌어오므로 그대로 두면 된다.

| 질문 | 넣을 값 |
| --- | --- |
| Application ID (패키지) | `com.minigame30.app` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / Splash color | `#FFF8E1` |
| Include support for Play Billing | `No` |
| Signing key 생성 | `Yes` (아래 경고 먼저 읽을 것) |

### targetSdk 36으로 올리기

**2026년 8월 31일부터 신규 앱은 API 36(Android 16) 이상을 타깃해야 한다.**
Bubblewrap 기본값은 35다. `app/build.gradle`에서 두 줄을 고친다.

```gradle
compileSdkVersion 36
targetSdkVersion 36
```

`platforms;android-36`이 없으면 먼저 받는다. `minSdkVersion`은 건드리지 않는다.

```powershell
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-36"
```

> `app/build.gradle`은 `bubblewrap init`이 템플릿에서 새로 찍어내는 파일이다.
> 다른 프로젝트에서 고쳤더라도 새 프로젝트에는 반영되지 않는다.

### 서명 키 — 제일 중요

> **`android.keystore`와 비밀번호 두 개를 잃어버리면 앱을 영원히 업데이트할 수 없다.**
> 같은 패키지 이름으로 새로 올리는 것도 안 된다.

만들자마자 백업한다. 파일은 클라우드 + USB 등 최소 두 군데, 비밀번호는 비밀번호 관리자에.
`.gitignore`에 없더라도 **절대 커밋하지 말 것.**

---

## 빌드

```powershell
cd C:\Workspace\MiniGame30-TWA
bubblewrap build
```

- `app-release-bundle.aab` ← **Play Console에 올릴 파일**
- `app-release-signed.apk` ← 폰에 직접 설치해 미리 확인용

폰에서 확인하려면 (USB 디버깅 켠 상태):

```powershell
C:\Android\Sdk\platform-tools\adb.exe install -r app-release-signed.apk
```

assetlinks 검증 전에는 **화면 위에 주소창이 뜬다. 정상이다.**

gradle로 직접 빌드해도 결과는 같지만(`gradlew.bat bundleRelease` →
`app\build\outputs\bundle\release\app-release.aab`), 이쪽은 `twa-manifest.json` 변경을
반영하지 않는다. 설정을 고쳤으면 `bubblewrap update`를 먼저 돌릴 것.

---

## assetlinks.json (주소창 없애기)

업로드가 끝나야 지문을 얻을 수 있다. 순서가 중요하다.

**Play Console → 테스트 및 출시 → 설정 → 앱 서명**에서 두 지문을 복사해
`public/.well-known/assetlinks.json`에 넣고 배포한다. 콜론이 들어간 대문자 16진수 그대로.

```json
"sha256_cert_fingerprints": [
  "앱 서명 키 SHA-256",
  "업로드 키 SHA-256"
]
```

배포 후 `https://web-game-ecru.vercel.app/.well-known/assetlinks.json`에서 JSON이 보여야 한다.
앱을 지웠다 다시 설치하면 주소창이 사라진다. 검증이 실패해도 앱은 돌아가지만 주소창이 남는다.

### 넣어 둔 지문

| 지문 | 출처 | 확인된 것 |
| --- | --- | --- |
| `4C:B0:2A...` | 앱 서명 키 인증서 | **내부 앱 공유 설치에서 이 지문으로 검증됐다** |
| `26:59:36...` | 업로드 키 인증서 | 쓰이는 경로를 아직 확인하지 못했다 |

내부 앱 공유 페이지의 "내부 테스트 인증서"(`59:B5...`)는 넣지 않아도 된다.
구글이 앱 서명 키로 재서명해서 배포하기 때문으로 보인다.
지금 조합이 실제로 동작하는 것을 확인한 상태라 **검증 없이 빼지 않는다.**

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
| --- | --- |
| `gradlew`가 `SDK location not found`로 죽음 | `local.properties`가 없다. `echo sdk.dir=C:/Android/Sdk > local.properties` (구분자는 `/`) |
| `bubblewrap build`가 라이선스에서 멈춤 | `sdkmanager.bat --licenses` 실행 후 전부 `y` |
| `JAVA_HOME` 관련 오류 | `bubblewrap updateConfig --jdkPath`로 JDK 17 경로 재지정 |
| 앱 위에 주소창이 계속 뜸 | assetlinks 미배포 / 지문 불일치 / 패키지 이름 불일치. 앱 재설치 후 재확인 |
| 업로드 시 "이미 사용된 버전 코드" | `appVersionCode`를 더 큰 값으로 올리고 재빌드. Console에서는 못 고친다 |
| 업로드 시 서명 키 불일치 | 처음 만든 `android.keystore`가 아닌 다른 키로 빌드함 |
| 앱 이름·아이콘이 안 바뀜 | 웹 배포보다 먼저 빌드했다. 배포 후 `bubblewrap update`부터 다시 |
