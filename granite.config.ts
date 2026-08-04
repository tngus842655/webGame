import { defineConfig } from '@apps-in-toss/web-framework/config'

// 앱인토스(토스 미니앱) 배포 설정. `npm run build:toss`가 이 파일을 읽어
// 웹 빌드를 돌린 뒤 결과를 minigame30.ait 으로 묶는다.
export default defineConfig({
  appName: 'minigame30',
  brand: {
    // 콘솔 '앱 정보'에 등록한 이름과 글자 하나까지 같아야 한다.
    // 영문으로 뒀다가 '미니앱 이름이 앱 정보등록에 제출된 이름과 동일해야 해요'로 반려됐다
    displayName: '미니게임30',
    primaryColor: '#FFCA28',
    icon: 'https://web-game-ecru.vercel.app/icon/icon-eng-512-v1.png',
  },
  // 카메라·위치 같은 기기 권한은 쓰지 않는다
  permissions: [],
  // 게임 웹뷰로 띄운다. 이 값이 'game'이어야 게임 미니앱으로 빌드되고,
  // 비게임 웹뷰에 걸리는 TDS(토스 디자인 시스템) 적용 의무를 받지 않는다.
  webViewProps: {
    type: 'game',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --mode toss',
      // --mode toss가 .env.toss를 읽는다. 미니앱 전용 분기(토스 로그인)가 여기서 켜진다
      build: 'vue-tsc --noEmit && vite build --mode toss',
    },
  },
  outdir: 'dist',
})
