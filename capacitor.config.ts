import type { CapacitorConfig } from '@capacitor/cli'

// 안드로이드 네이티브 앱 설정. TWA(배포된 웹사이트를 크롬으로 띄우는 방식)를 대체한다.
// 웹 빌드 결과(dist)를 앱 안에 통째로 넣고 앱 내부 웹뷰로 띄우므로 크롬이 뜨지 않는다.
//
// appId는 Play Console에 이미 올라간 패키지 이름이다. 절대 바꾸지 말 것 —
// 바꾸는 순간 기존 앱을 업데이트할 수 없고 12명/14일 카운터도 처음부터 다시 돈다.
const config: CapacitorConfig = {
  appId: 'com.minigame30.app',
  appName: 'MiniGame30',
  webDir: 'dist',
  android: {
    // 자바스크립트 오류가 나도 흰 화면 대신 로그를 남긴다 (release에서는 무시된다)
    webContentsDebuggingEnabled: false,
  },
  server: {
    // https://localhost 로 서빙한다. http로 두면 secure context가 아니라서
    // crypto.subtle(Supabase PKCE)과 localStorage 격리가 브라우저와 달라진다.
    androidScheme: 'https',
  },
  plugins: {
    // 안드로이드 16부터는 상태바 뒤까지 앱이 그려지는 게 강제라 배경색을 지정할 수 없다.
    // 아이콘 명암만 고를 수 있고, 배경(#FFF8E1)이 밝으므로 어두운 아이콘 쪽이다.
    // 잘리면 안 되는 영역은 main.css가 --safe-area-inset-* 로 받아 처리한다.
    SystemBars: {
      style: 'LIGHT',
    },
    SplashScreen: {
      // 웹뷰가 첫 화면을 그릴 때까지만 덮는다. AppLayout이 사전 로딩을 마치고
      // 직접 내리므로(main.ts) 자동 시간 제한은 넉넉히 두고 끄지 않는다.
      launchAutoHide: false,
      backgroundColor: '#FFF8E1',
      androidSpinnerStyle: 'small',
      spinnerColor: '#8D6E63',
    },
  },
}

export default config
