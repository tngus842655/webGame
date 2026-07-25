import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import { ensureUserId } from './shared/auth'
import './styles/main.css'

createApp(AppLayout).use(router).mount('#app')

// 첫 방문 시 익명 세션 부트스트랩 — 실패해도 점수 제출 시점에 재시도된다
void ensureUserId().catch(() => {})
