import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import { loadLocale, locale } from './shared/i18n'
import { checkAppUpdate } from './shared/appUpdate'
import { exitApp, startNativeShell } from './shared/native'
// 첫 적용은 index.html이 하고, 이 import는 그 뒤를 잇는다 — 설정 화면을 한 번도
// 열지 않아도 '시스템'을 고른 사람이 폰 설정을 바꾸면 바로 따라가야 한다.
import './shared/theme'
import './styles/main.css'

// 게임 카드는 <a>라서 길게 누르면 웹뷰가 링크 주소를 띄운다. body의
// -webkit-touch-callout은 iOS 전용이라 안드로이드 웹뷰에서는 그대로 뜬다.
// 닉네임 입력칸은 붙여넣기 메뉴가 필요하므로 거기서만 남겨둔다.
document.addEventListener('contextmenu', (event) => {
  const target = event.target as Element | null
  if (target?.closest('input, textarea')) return
  event.preventDefault()
})

// 계정 생성(익명 세션)은 여기서 하지 않는다. 게임 화면에 들어가야 만들어진다 —
// 사이트만 열고 나간 방문자까지 계정이 쌓이는 걸 막기 위해서다 (playSessions.ts 참고)
//
// 사전은 고른 언어 하나만 받아 온다. 그리기 전에 기다리는 이유는, 첫 화면이
// 영어로 떴다가 바뀌면 그 깜빡임이 제일 먼저 보이는 인상이 되기 때문이다.
// 안드로이드 하드웨어 뒤로가기. 홈에서 누르면 앱을 닫고, 그 외에는 한 화면 되돌린다.
// router.back()은 웹에서 브라우저 뒤로가기를 눌렀을 때와 같은 popstate를 내므로
// 광고 오버레이처럼 그걸 듣고 있는 것들이 따로 손대지 않아도 같이 닫힌다.
function goBack() {
  if (router.currentRoute.value.path === '/') void exitApp()
  else router.back()
}

void loadLocale(locale.value).then(() => {
  createApp(AppLayout).use(router).mount('#app')
  // 스플래시는 첫 화면을 그린 뒤에 내린다 — 먼저 내리면 흰 화면이 한 번 스친다
  void startNativeShell(goBack)
  // 스토어에 새 버전이 있으면 Play가 알린다 (안드로이드 앱에서만, 웹은 그냥 지나간다)
  void checkAppUpdate()
})
