<script setup lang="ts">
// 온보딩을 마치기 전에는 앱을 열지 않는다 — 계정 생성 시점을 온보딩 끝으로 미루기 위해서다.
// 소셜 로그인으로 돌아온 경우(세션이 이미 있음)는 온보딩을 마친 것으로 본다.
import { onMounted, ref } from 'vue'
import OnboardingFlow from '@/shared/OnboardingFlow.vue'
import { getCurrentUserId } from '@/shared/auth'
import { flushPendingScores } from '@/shared/scores'

const ONBOARDED_KEY = 'webgame:onboarded'
const ready = ref(false)
const needsOnboarding = ref(false)

function finish() {
  localStorage.setItem(ONBOARDED_KEY, 'done')
  needsOnboarding.value = false
}

onMounted(async () => {
  if (localStorage.getItem(ONBOARDED_KEY)) {
    ready.value = true
    void flushPendingScores().catch(() => {})
    return
  }
  // 온보딩 기록은 없지만 세션이 살아 있는 경우 = 소셜 로그인으로 막 돌아왔거나
  // 저장소만 지워진 재방문자. 계정이 이미 있으니 다시 묻지 않는다.
  const existing = await getCurrentUserId().catch(() => null)
  if (existing) {
    finish()
    void flushPendingScores().catch(() => {})
  } else {
    needsOnboarding.value = true
  }
  ready.value = true
})
</script>

<template>
  <div class="app-shell">
    <OnboardingFlow v-if="ready && needsOnboarding" @done="finish" />
    <RouterView v-else-if="ready" />
  </div>
</template>
