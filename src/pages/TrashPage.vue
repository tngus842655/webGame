<script setup lang="ts">
// 사용자용 휴지통 — 주 목록에서 내려간 게임을 계속 즐길 수 있게 모아둔다.
// 관리자가 숨김까지 건 게임은 여기서도 빠진다.
import { GAMES } from '@/games/registry'
import GameCard from '@/shared/GameCard.vue'
import { t } from '@/shared/i18n'
import { getLocalBest, popularityRanks, trashedGames } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

// 순위는 홈과 같은 기준으로 매긴다 — 그래서 홈에서 비어 보이는 번호가 여기에 있다
const ranks = popularityRanks(GAMES)
const cards = trashedGames(GAMES).map((game) => ({
  ...game,
  rank: ranks.get(game.slug) ?? null,
  best: getLocalBest(game.slug),
}))
</script>

<template>
  <div class="trash">
    <header class="trash-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('trash.title') }}</h1>
    </header>

    <p class="hint">{{ t('trash.hint') }}</p>

    <p v-if="cards.length === 0" class="notice">{{ t('trash.empty') }}</p>
    <main v-else class="game-grid">
      <GameCard
        v-for="game in cards"
        :key="game.slug"
        :slug="game.slug"
        :title-key="game.titleKey"
        :rank="game.rank"
        :label="game.best === null ? '' : t('home.best', { n: game.best.toLocaleString() })"
      />
    </main>
  </div>
</template>

<style scoped>
.trash {
  padding: 20px 16px;
}

.trash-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.trash-header h1 {
  font-size: 20px;
}

.hint {
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #bcaaa4;
  word-break: keep-all;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: #8d6e63;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

</style>
