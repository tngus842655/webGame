# 실기기 디버깅 (adb)

폰을 USB로 물려 놓고 고친 것을 바로 확인하는 방법. 릴리스 빌드와 Play 업로드는
`ANDROID_RELEASE.md`에 있다.

**Android Studio는 필요 없다.** 이 프로젝트는 `gradlew`로 직접 빌드하고 `adb`로 설치한다.
Studio가 필요한 건 `npm run open:android` 하나뿐이라 안 쓰면 그만이다.

광고처럼 **웹에서는 확인이 안 되는 것**을 볼 때 쓴다. 리워드 광고는 앱에서만 AdMob으로
가고 웹에서는 가짜 광고(스텁)로 떨어지므로, 실제 SDK 동작은 실기기에서만 드러난다.

## 준비물

| 항목 | 값 |
| --- | --- |
| JDK 21 | `ANDROID_RELEASE.md` 참고 (17로는 안 된다) |
| Android SDK | `C:\Android\Sdk` |
| adb | `C:\Android\Sdk\platform-tools\adb.exe` — SDK에 들어 있다 |

`adb`를 매번 전체 경로로 치기 번거로우니 창을 열 때 한 번 등록한다.

```powershell
set PATH=%PATH%;C:\Android\Sdk\platform-tools
```

**이 창에서만 유효하다.** 새 창을 열면 다시 쳐야 하고, 안 하면 `'adb'은(는) 내부 또는
외부 명령... 아닙니다`가 뜬다.

## 폰 준비 (처음 한 번)

1. **개발자 옵션 켜기** — `설정 → 휴대전화 정보 → 소프트웨어 정보 → 빌드번호`를 7번 탭
2. **USB 디버깅 켜기** — 개발자 옵션 안. 목록이 길어 놓치기 쉬우니 **설정 검색창에
   `USB 디버깅`** 을 치는 게 빠르다. '진단 모드' 같은 비슷한 이름의 다른 항목이 있으니
   이름을 정확히 확인할 것
3. **USB 연결 모드를 `파일 전송`으로** — 알림창을 내려 USB 알림을 탭해서 바꾼다.
   충전 전용으로 물려 있으면 디버깅을 켜도 adb 눈에 안 보인다
4. **허용 팝업** — 위가 다 되면 폰에 "USB 디버깅을 허용하시겠습니까?"가 반드시 한 번
   뜬다. 허용을 누른다 ('항상 허용'을 체크하면 다음부터 안 묻는다)

> 이 팝업을 한 번도 못 봤다면 2번이나 3번이 안 된 것이다. **케이블이 충전 전용이면**
> 데이터선이 아예 없어서 무엇을 해도 안 잡힌다 — 다른 케이블부터 의심할 것.

## 설치까지 한 번에

```powershell
set PATH=%PATH%;C:\Android\Sdk\platform-tools

cd C:\Workspace\webGame
npm run build:android

cd android
gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.minigame30.app/.MainActivity
```

각 단계에서 이게 나와야 다음으로 간다.

| 명령 | 성공 표시 | 하는 일 |
| --- | --- | --- |
| `adb devices` | `<시리얼>  device` | 폰이 잡혔는지 확인 |
| `npm run build:android` | `✓ built` + `Sync finished` | `vite build` + `cap sync` — **웹 결과를 앱 폴더로 복사** |
| `gradlew.bat assembleDebug` | `BUILD SUCCESSFUL` | 디버그 APK 생성 |
| `adb install -r ...` | `Success` | 설치. **실행은 안 한다** |
| `adb shell am start -n ...` | 폰에서 앱이 켜짐 | 실행 (폰에서 아이콘을 눌러도 같다) |

**`npm run build:android`을 건너뛰고 gradle만 돌리면 예전 웹 빌드가 그대로 앱에 들어간다.**
코드를 고쳤는데 아무것도 안 바뀌는 원인의 대부분이 이것이다.

## 자주 막히는 곳

| 증상 | 원인 / 해결 |
| --- | --- |
| `'adb'은(는) 내부 또는 외부 명령...` | `set PATH` 줄을 안 쳤거나 다른 창에서 쳤다. 창마다 다시 쳐야 한다 |
| `adb devices`가 비어 있음 | 충전 전용 케이블이거나 USB 모드가 충전 전용. 케이블부터 바꿔볼 것. 안 되면 `adb kill-server` 후 재시도 |
| `unauthorized`로 뜸 | 폰에 허용 팝업이 떠 있는데 안 눌렀다 |
| `offline`로 뜸 | 케이블을 뽑았다 다시 꽂는다 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 폰에 Play로 받은 앱이 있다. 디버그 APK는 서명 키가 달라 덮어쓸 수 없으니 **폰에서 먼저 삭제**한다 |
| `install`은 `Success`인데 앱이 안 뜸 | 정상이다. `install`은 설치만 한다. `adb shell am start`로 띄우거나 아이콘을 누른다 |
| 고친 코드가 반영 안 됨 | `npm run build:android`을 건너뛰었다 |
| `findstr`이 아무 것도 안 내놓고 멈춤 | 검색할 파일 경로를 빼먹었다. 경로가 없으면 키보드 입력을 기다린다. `Ctrl+C` |

## 웹 빌드가 앱에 들어갔는지 확인

`cap sync`는 `dist/`를 `android/app/src/main/assets/public/`으로 복사한다. 값이 제대로
박혔는지는 그 폴더를 뒤져 보면 바로 안다. 예를 들어 광고 ID가 들어갔는지:

```powershell
cd C:\Workspace\webGame\android
findstr /s /m "3940256099942544" app\src\main\assets\public\assets\*.js
```

파일 이름이 하나라도 나오면 들어간 것이다. 아무것도 안 나오면 `.env.local`에 값이
없거나 `npm run build:android`을 안 돌린 것이다.

> `import.meta.env.VITE_*`는 **빌드할 때 문자열로 박힌다.** 그래서 APK를 만든 PC의
> `.env.local` 값이 앱에 그대로 굳는다. Vercel 환경 변수는 웹 배포에만 쓰이고 앱과는
> 무관하다 — 값을 바꾸면 앱을 다시 빌드해야 한다.

## 로그 보기

```powershell
adb logcat -s Ads          # AdMob SDK (광고 요청·실패 사유)
adb logcat -s Capacitor    # 플러그인 쪽
adb logcat -s chromium     # 웹뷰 콘솔 (console.log·JS 오류)
```

광고가 안 뜰 때 `Ads` 태그를 보면 `No fill`(재고 없음)인지 `Invalid app ID`인지 바로 나온다.

## USB가 끝내 안 잡힐 때

**무선 디버깅** (Android 11+). 드라이버 문제를 통째로 우회한다. PC와 폰이 같은 Wi-Fi에
있어야 한다.

1. 폰: `개발자 옵션 → 무선 디버깅` 켜기
2. `페어링 코드로 기기 페어링` 탭 → IP·포트·6자리 코드가 뜬다
3. PC:
   ```powershell
   adb pair 192.168.0.10:37xxx      # 페어링 화면의 포트 → 코드 입력
   adb connect 192.168.0.10:5xxxx   # 무선 디버깅 메인 화면의 포트 (다르다)
   ```

**페어링 포트와 연결 포트가 다르다.** 두 화면의 포트를 섞으면 안 붙는다.

---

adb에 시간을 너무 쓰게 되면 그냥 **APK 파일을 폰으로 옮겨** 설치해도 된다. 확인이
목적이지 adb가 목적은 아니다.

```powershell
explorer app\build\outputs\apk\debug
```

탐색기가 열리면 `app-debug.apk`를 카톡 '나에게 보내기'나 드라이브로 옮겨 폰에서 탭한다.
"알 수 없는 출처" 허용을 물으면 허용한다.
