import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import { loadLocale, locale } from './shared/i18n'
import './styles/main.css'

// 계정 생성(익명 세션)은 여기서 하지 않는다. 온보딩을 마쳐야 만들어진다 —
// 사이트만 열고 나간 방문자까지 계정이 쌓이는 걸 막기 위해서다 (AppLayout.vue 참고)
//
// 사전은 고른 언어 하나만 받아 온다. 그리기 전에 기다리는 이유는, 첫 화면이
// 영어로 떴다가 바뀌면 그 깜빡임이 제일 먼저 보이는 인상이 되기 때문이다.
void loadLocale(locale.value).then(() => {
  createApp(AppLayout).use(router).mount('#app')
})
