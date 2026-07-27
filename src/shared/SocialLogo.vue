<script setup lang="ts">
// 소셜 로그인 버튼의 브랜드 로고 — 설정 화면과 온보딩이 같은 것을 쓴다.
// 각 사의 브랜드 색이라 currentColor를 따르지 않는다.
import type { SocialProvider } from './auth'

defineProps<{ provider: SocialProvider }>()
</script>

<template>
  <svg v-if="provider === 'google'" class="social-logo" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285f4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34a853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#fbbc05"
      d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#ea4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>

  <svg v-else class="social-logo" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#3c1e1e"
      d="M12 3.4c-5.08 0-9.2 3.26-9.2 7.27 0 2.55 1.67 4.79 4.19 6.08-.18.66-.67 2.46-.77 2.84-.12.48.18.47.37.34.15-.1 2.39-1.62 3.36-2.29.66.1 1.35.15 2.05.15 5.08 0 9.2-3.26 9.2-7.12S17.08 3.4 12 3.4z"
    />
  </svg>
</template>

<style scoped>
.social-logo {
  flex: none;
  width: 18px;
  height: 18px;
}
</style>
