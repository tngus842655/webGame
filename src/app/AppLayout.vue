<script setup lang="ts">
// 시작하기 전에 묻는 화면은 두지 않는다. 게임 주소를 그대로 열면 그 게임이 바로 떠야 한다 —
// 링크를 받고 들어온 사람에게 언어·닉네임부터 묻는 화면은 가입 절차로 읽힌다.
// 언어는 브라우저 설정에서 감지하고(못 찾으면 영어), 닉네임은 계정이 생기는 순간
// DB가 'Guest-xxxx'로 채운다. 둘 다 설정 화면에서 언제든 바꿀 수 있다.
import { onMounted } from 'vue'
import { flushPendingScores } from '@/shared/scores'
import UpdatePrompt from '@/shared/UpdatePrompt.vue'

// 보내지 못하고 남아 있던 점수를 올린다 (오프라인·전송 실패분). 남은 게 없으면 그냥 지나간다.
onMounted(() => void flushPendingScores().catch(() => {}))
</script>

<template>
  <div class="app-shell">
    <RouterView />
    <!-- 새 버전이 있을 때만 스스로 뜬다 (안드로이드 앱에서만) -->
    <UpdatePrompt />
  </div>
</template>
