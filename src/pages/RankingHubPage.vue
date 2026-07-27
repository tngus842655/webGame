<script setup lang="ts">
import { onMounted } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { refreshPopularity, sortByPopularity } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

// 홈과 동일한 인기순 정렬 — 캐시로 첫 렌더부터 확정하고, 새 값은 다음 진입에 반영한다
const games = sortByPopularity(GAMES)

onMounted(() => {
  void refreshPopularity()
})
</script>

<template>
  <div class="ranking-hub">
    <header class="hub-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('home.ranking') }}</h1>
    </header>

    <ul class="game-list">
      <li v-for="game in games" :key="game.slug">
        <RouterLink class="row" :to="`/ranking/${game.slug}`">
          <span class="thumb"><GameIcon :slug="game.slug" /></span>
          <span class="title">{{ t(game.titleKey) }}</span>
          <span class="arrow"><UiIcon name="chevron" /></span>
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
  padding: 11px 12px 11px 14px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 4px rgb(93 64 55 / 0.07);
  transition: transform 0.1s ease;
}

.row:active {
  transform: scale(0.985);
  background: #fffaf2;
}

.thumb {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.title {
  flex: 1;
  font-weight: 700;
  color: #4e342e;
}

.arrow {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: #cbbcb5;
}
</style>
