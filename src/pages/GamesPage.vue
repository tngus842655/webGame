<script setup lang="ts">
// 게임 전체보기 — 홈은 선별된 게임만 세우고, 전체 목록은 이 화면이 맡는다.
import { GAMES } from '@/games/registry'
import GameCard from '@/shared/GameCard.vue'
import { t } from '@/shared/i18n'
import { getLocalBest, sortByPopularity } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

// 순서는 홈과 같은 인기순(신규 먼저) — 화면마다 다르면 같은 게임을 두 번 찾게 된다
const cards = sortByPopularity(GAMES).map((game) => ({
  ...game,
  best: getLocalBest(game.slug),
}))
</script>

<template>
  <div class="games">
    <header class="games-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('games.title') }}</h1>
    </header>

    <main class="game-grid">
      <GameCard
        v-for="game in cards"
        :key="game.slug"
        favoritable
        :slug="game.slug"
        :title-key="game.titleKey"
        :label="game.best === null ? '' : t('home.best', { n: game.best.toLocaleString() })"
      />
    </main>
  </div>
</template>

<style scoped>
.games {
  padding: 20px 16px;
}

.games-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.games-header h1 {
  font-size: 20px;
}

/* 홈과 같은 이유로 minmax(0, …) — 1fr은 min-content 아래로 줄지 않아
   좁은 화면에서 카드가 오른쪽으로 넘친다 */
.game-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
</style>
