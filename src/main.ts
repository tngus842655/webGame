import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import './styles/main.css'

// 계정 생성(익명 세션)은 여기서 하지 않는다. 온보딩을 마쳐야 만들어진다 —
// 사이트만 열고 나간 방문자까지 계정이 쌓이는 걸 막기 위해서다 (AppLayout.vue 참고)
createApp(AppLayout).use(router).mount('#app')
