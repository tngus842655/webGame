<script setup lang="ts">
import { onMounted } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { refreshPopularity, sortByPopularity } from '@/shared/scores'

// 홈과 동일한 인기순 정렬 — 캐시로 첫 렌더부터 확정하고, 새 값은 다음 진입에 반영한다
const games = sortByPopularity(GAMES)

onMounted(() => {
  void refreshPopularity()
})
</script>

<template>
  <div class="ranking-hub">
    <header class="hub-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ t('home.ranking') }}</h1>
    </header>

    <ul class="game-list">
      <li v-for="game in games" :key="game.slug">
        <RouterLink class="row" :to="`/ranking/${game.slug}`">
          <span class="thumb"><GameIcon :slug="game.slug" /></span>
          <span class="title">{{ t(game.titleKey) }}</span>
          <span class="arrow">›</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ranking-hub {
  padding: 20px 16px;
}

.hub-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.hub-header h1 {
  font-size: 20px;
}

.game-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
}

.thumb {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.title {
  flex: 1;
  font-weight: bold;
}

.arrow {
  color: #bcaaa4;
  font-size: 20px;
}
</style>
