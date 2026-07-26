import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import { ensureUserId } from './shared/auth'
import { flushPendingScores } from './shared/scores'
import './styles/main.css'

createApp(AppLayout).use(router).mount('#app')

// 첫 방문 시 익명 세션 부트스트랩 — 실패해도 점수 제출 시점에 재시도된다.
// 세션이 준비된 뒤 지난 실행에서 제출하지 못한 점수를 올린다 (익명 로그인 중복 방지를 위해 순차 실행)
void ensureUserId()
  .then(() => flushPendingScores())
  .catch(() => {})
