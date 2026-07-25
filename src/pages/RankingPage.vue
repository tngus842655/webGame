<script setup lang="ts">
import { useRoute } from 'vue-router'
import { GAMES } from '@/games/registry'

const route = useRoute()
const game = GAMES.find((g) => g.slug === String(route.params.slug))
</script>

<template>
  <div class="stub-page">
    <h1>{{ game?.title ?? '알 수 없는 게임' }} 랭킹</h1>
    <p>M3(Supabase 연동) 단계에서 구현됩니다.</p>
    <RouterLink to="/">← 홈으로</RouterLink>
  </div>
</template>

<style scoped>
.stub-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 20px;
  text-align: center;
}

.stub-page p {
  color: #8d6e63;
}
</style>
