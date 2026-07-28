# 안드로이드 출시 절차 (Bubblewrap TWA → Google Play)

웹으로 배포된 미니게임30을 그대로 안드로이드 앱 껍데기에 담아 Play 스토어에 올리는 방법.
다음에 다시 할 때 이 문서만 따라가면 되도록 실제 명령어까지 적어 둔다.

## 전제

| 항목 | 값 |
| --- | --- |
| 배포 주소 | `https://web-game-ecru.vercel.app` |
| 매니페스트 | `https://web-game-ecru.vercel.app/manifest.webmanifest` |
| 패키지 이름 | `com.minigame30.app` |
| Android SDK | `C:\Android\Sdk` |

> **패키지 이름은 한 번 출시하면 영영 못 바꾼다.** 다른 이름을 쓰고 싶으면 지금 정하고,
> 아래 4단계와 `public/.well-known/assetlinks.json`을 같이 고칠 것.

TWA는 앱 안에 게임을 넣는 게 아니라 **배포된 웹사이트를 크롬 엔진으로 띄우는 방식**이다.
그래서 사이트가 죽으면 앱도 죽고, 게임을 고치면 앱 업데이트 없이 바로 반영된다.

---

## 1. JDK 17 준비

Bubblewrap은 JDK 17을 쓴다. 이미 깔려 있으면 건너뛴다.

```powershell
java -version
```

없으면 [Adoptium Temurin 17](https://adoptium.net/temurin/releases/?version=17) (Windows x64 `.msi`)을 설치한다.
설치 경로를 기억해 둘 것 (보통 `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`).

## 2. Bubblewrap 설치

```powershell
npm i -g @bubblewrap/cli
bubblewrap --version
```

## 3. SDK / JDK 경로 물려주기

처음 `bubblewrap` 명령을 돌리면 JDK와 Android SDK 경로를 묻는다.
이때 **새로 받겠다고 하지 말고** 이미 있는 경로를 넣는다.

- Android SDK: `C:\Android\Sdk`
- JDK: 1단계에서 설치한 경로

이 값은 `C:\Users\<사용자>\.bubblewrap\config.json`에 저장된다.
잘못 넣었으면 그 파일을 직접 고치거나 아래로 다시 설정한다.

```powershell
bubblewrap updateConfig --jdkPath "C:\Program Files\Eclipse Adoptium\jdk-17.0.13-hotspot"
bubblewrap updateConfig --androidSdkPath "C:\Android\Sdk"
```

SDK 라이선스 동의가 안 돼 있으면 빌드가 중간에 멈춘다. 미리 처리해 둔다.

```powershell
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat --licenses
```

## 4. 프로젝트 만들기

저장소 바깥에 작업 폴더를 하나 판다. (예: `C:\Workspace\MiniGame30-TWA`)
**저장소 안에 만들면 안 된다** — keystore가 git에 딸려 올라간다.

```powershell
mkdir C:\Workspace\MiniGame30-TWA
cd C:\Workspace\MiniGame30-TWA
bubblewrap init --manifest https://web-game-ecru.vercel.app/manifest.webmanifest
```

대화형으로 묻는 것들:

| 질문 | 넣을 값 |
| --- | --- |
| Domain | `web-game-ecru.vercel.app` |
| Application name | `MiniGame30` |
| Short name | `MiniGame30` |
| Application ID (패키지) | `com.minigame30.app` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar color | `#FFF8E1` |
| Splash screen color | `#FFF8E1` |
| Include support for Play Billing | `No` |
| Signing key 생성 | `Yes` (아래 5단계 주의사항 먼저 읽을 것) |

끝나면 `twa-manifest.json`이 생긴다. 나중에 설정을 바꿀 땐 이 파일을 고치고
`bubblewrap update`를 돌리면 된다.

> `bubblewrap init`은 앱 이름을 `manifest.webmanifest`에서 끌어오므로 `미니게임30`이 기본값으로
> 뜬다. 스토어 기본 언어가 영어라 **`MiniGame30`으로 덮어쓴다.** 런처에 뜨는 이름은 언어별로
> 나뉘지 않고 빌드 시점에 하나로 고정돼서, 한글로 두면 해외 사용자 홈 화면에도 한글이 뜬다.

### targetSdk 확인

**2026년 8월 31일부터 신규 앱은 API 36(Android 16) 이상을 타깃해야 한다.**
지금 올리면 심사 통과 시점이 아슬아슬하니 처음부터 36으로 맞추고 간다.

`twa-manifest.json`을 열어 확인한다.

```json
"targetSdkVersion": 36
```

값이 없거나 36보다 낮으면 36으로 고치고 `bubblewrap update`를 돌린다.
그래도 안 잡히면 생성된 `app/build.gradle`의 `targetSdkVersion`을 직접 고친다.

## 5. 서명 키 (제일 중요)

`bubblewrap init`이 `android.keystore`를 만들면서 비밀번호 두 개(키스토어/키)를 묻는다.

> **이 파일과 비밀번호를 잃어버리면 앱을 영원히 업데이트할 수 없다.**
> 같은 패키지 이름으로 새로 올리는 것도 안 된다. 앱을 통째로 다시 만들어야 한다.

바로 백업한다.

- `android.keystore` 파일 → 클라우드 드라이브 + USB 등 최소 두 군데
- 비밀번호 두 개 → 비밀번호 관리자에 저장

`.gitignore`에 없더라도 **절대 저장소에 커밋하지 말 것.**

## 6. 빌드

```powershell
cd C:\Workspace\MiniGame30-TWA
bubblewrap build
```

키스토어 비밀번호를 묻는다. 끝나면 두 파일이 나온다.

- `app-release-bundle.aab` ← **Play Console에 올릴 파일**
- `app-release-signed.apk` ← 내 폰에 직접 설치해서 미리 확인용

폰에서 먼저 확인해 보려면 (USB 디버깅 켠 상태에서):

```powershell
C:\Android\Sdk\platform-tools\adb.exe install -r app-release-signed.apk
```

이 시점엔 아직 assetlinks 검증이 안 돼서 **화면 위에 주소창이 뜬다. 정상이다.**
9단계까지 마치면 사라진다.

## 7. Play Console에 앱 만들기

[Play Console](https://play.google.com/console) → **앱 만들기**

| 항목 | 값 |
| --- | --- |
| 앱 이름 | 미니게임30 |
| 기본 언어 | 한국어 |
| 앱 or 게임 | **게임** |
| 무료 or 유료 | 무료 |

만든 뒤 왼쪽 메뉴의 **대시보드**에 뜨는 필수 항목을 순서대로 채운다.
분량이 많으니 한 번에 다 하려 하지 말 것.

- 앱 액세스 권한 (로그인 필요하면 심사용 테스트 계정 제공)
- 광고 포함 여부 → **리워드 광고를 쓰면 "예"**
- 콘텐츠 등급 설문
- 타겟층 및 콘텐츠
- 데이터 보안 (Supabase에 계정/기록을 저장하므로 수집 항목을 정직하게 기재)
- 개인정보처리방침 URL — **웹에 공개된 주소가 하나 필요하다**

### 스토어 등록정보에 필요한 이미지

| 항목 | 규격 | 현재 상태 |
| --- | --- | --- |
| 앱 아이콘 | 512×512 PNG | `public/icon/icon-512-v1.png` 재사용 가능 |
| 그래픽 이미지 | 1024×500 PNG/JPG | **새로 만들어야 함** |
| 휴대전화 스크린샷 | 최소 2장, 16:9 또는 9:16 | **새로 찍어야 함** |

그래픽 이미지와 스크린샷은 직접 준비해 주세요. 스크린샷은 폰에서 게임 몇 개를
실행해 찍으면 되고, 그래픽 이미지는 필요하면 따로 요청 주시면 시안을 잡겠습니다.

## 8. 업로드 — 내부 테스트 먼저, 비공개 테스트는 그 다음

트랙이 세 개인데 **역할이 다르다. 순서를 지켜야 시간을 아낀다.**

| 트랙 | 심사 | 12명·14일 인정 | 용도 |
| --- | --- | --- | --- |
| 내부 테스트 | 거의 없음 (수 분) | **안 됨** | 앱이 제대로 도는지 빨리 확인 |
| 비공개 테스트 | 있음 (수 시간~며칠) | **됨** | 여기서 14일 시계가 돈다 |
| 프로덕션 | 있음 | — | 정식 출시 |

### 8-1. 내부 테스트로 먼저 확인

**테스트 및 출시 → 테스트 → 내부 테스트** → 새 버전 만들기

1. `app-release.aab` 업로드
2. **Play 앱 서명**은 기본값 그대로 사용 (동의)
3. 출시명/출시 노트 작성 후 검토 → 출시 시작
4. 테스터 목록에 내 계정을 넣고 옵트인 링크로 설치해 확인

여기서 9단계(assetlinks)까지 마쳐 주소창이 사라지는 것까지 보고 넘어간다.
잘못된 빌드로 비공개 테스트를 시작하면 14일을 날린다.

### 8-2. 확인 끝나면 비공개 테스트로

**테스트 및 출시 → 테스트 → 비공개 테스트** → 같은 AAB를 올린다.
여기부터 10단계의 12명·14일이 적용된다.

## 9. assetlinks.json 채우기 (주소창 없애기)

업로드가 끝나야 지문을 얻을 수 있다. 순서가 중요하다.

**Play Console → 테스트 및 출시 → 설정 → 앱 서명**에서 두 개를 복사한다.

- **앱 서명 키 인증서**의 SHA-256 지문
- **업로드 키 인증서**의 SHA-256 지문

저장소의 `public/.well-known/assetlinks.json`을 열어 자리표시자를 바꾼다.

```json
"sha256_cert_fingerprints": [
  "앱 서명 키 SHA-256",
  "업로드 키 SHA-256"
]
```

콜론(`:`)이 들어간 대문자 16진수 형태 그대로 붙여넣으면 된다.
커밋하고 push하면 Vercel이 자동 배포한다. 배포 후 확인:

```
https://web-game-ecru.vercel.app/.well-known/assetlinks.json
```

JSON이 그대로 보여야 한다. 앱을 지웠다 다시 설치하면 주소창이 사라진다.

> 검증이 실패해도 앱은 돌아간다. 다만 위에 주소창이 계속 붙어서 웹사이트 티가 난다.

## 10. 12명 / 14일 비공개 테스트

2023년 11월 13일 이후에 만든 **개인** 개발자 계정이면, 정식 출시 전에
**서로 다른 구글 계정 12개가 14일 연속으로 비공개 테스트에 참여**해야 한다.
(사업자 계정은 면제)

- 비공개 테스트 트랙에 이메일 목록 또는 구글 그룹으로 테스터를 등록
- 각자 옵트인 링크로 참여 + 실기기에 설치해야 인정된다 (에뮬레이터·중복 계정 불가)
- 14일 카운트는 **심사 승인 + 12명 옵트인이 모두 충족된 시점부터** 시작
- 중간에 인원이 12명 아래로 떨어지면 카운트가 깨진다

가족·지인 계정을 미리 12개 확보해 두는 게 현실적으로 제일 빠르다.

## 11. 정식 출시

14일을 채우면 대시보드에 **프로덕션 액세스 신청** 버튼이 열린다.
신청서(테스트에서 배운 점 등)를 작성해 제출하고, 승인되면 프로덕션 트랙에
같은 AAB를 올려 출시한다. 첫 심사는 며칠 걸릴 수 있다.

---

## 다음 버전 올릴 때

게임 내용만 고쳤다면 **웹 배포만 하면 끝이다.** 앱 업데이트가 필요 없다.

앱 껍데기 자체(아이콘, 이름, targetSdk 등)를 고칠 때만:

```powershell
cd C:\Workspace\MiniGame30-TWA
```

`twa-manifest.json`에서 두 값을 올린다.

```json
"appVersionCode": 2,
"appVersionName": "1.1.0"
```

`appVersionCode`는 **반드시 이전보다 커야** 업로드가 된다.

```powershell
bubblewrap update
bubblewrap build
```

나온 `app-release-bundle.aab`를 Play Console에 새 버전으로 올린다.
이때도 **같은 keystore**를 써야 한다.

---

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
| --- | --- |
| `bubblewrap build`가 라이선스에서 멈춤 | `sdkmanager.bat --licenses` 실행 후 전부 `y` |
| `JAVA_HOME` 관련 오류 | `bubblewrap updateConfig --jdkPath`로 JDK 17 경로 재지정 |
| 앱 위에 주소창이 계속 뜸 | assetlinks.json 미배포 / 지문 불일치 / 패키지 이름 불일치. 앱 재설치 후 재확인 |
| 업로드 시 "이미 사용된 버전 코드" | `appVersionCode`를 더 큰 값으로 |
| 업로드 시 서명 키 불일치 | 처음 만든 `android.keystore`가 아닌 다른 키로 빌드함 |
| API 레벨 부족 경고 | `targetSdkVersion`을 36으로 올리고 재빌드 |
