<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import {
  fetchMyStats,
  getLocalBest,
  refreshPopularity,
  sortByPopularity,
  type MyGameStat,
} from '@/shared/scores'


// 기록이 없어도 빈 문자열을 반환해 한 줄을 차지한다 (CSS에서 높이 확보)
function scoreLabel(card: { best: number | null; stat: MyGameStat | null }): string {
  if (card.stat) {
    return t('home.myRank', {
      score: card.stat.best_score.toLocaleString(),
      rank: card.stat.rank,
    })
  }
  return card.best === null ? '' : t('home.best', { n: card.best.toLocaleString() })
}

// 카드 순서는 캐시된 인기순으로 처음부터 확정하고, 서버 응답으로는 내 기록만 채운다
const cards = ref(
  sortByPopularity(GAMES).map((game) => ({
    ...game,
    best: getLocalBest(game.slug),
    stat: null as MyGameStat | null,
  })),
)

onMounted(async () => {
  const [, myStats] = await Promise.all([
    refreshPopularity(),
    fetchMyStats().catch(() => [] as MyGameStat[]),
  ])
  const statBySlug = new Map(myStats.map((stat) => [stat.game_slug, stat]))
  cards.value = cards.value.map((card) => ({ ...card, stat: statBySlug.get(card.slug) ?? null }))
})
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>{{ t('app.title') }}</h1>
      <nav class="header-links">
        <RouterLink to="/ranking" :aria-label="t('home.ranking')">🏆</RouterLink>
        <RouterLink to="/stats" :aria-label="t('stats.title')">📊</RouterLink>
        <RouterLink to="/settings" :aria-label="t('settings.title')">⚙️</RouterLink>
      </nav>
    </header>

    <main class="game-grid">
      <RouterLink
        v-for="game in cards"
        :key="game.slug"
        class="game-card"
        :to="`/play/${game.slug}`"
      >
        <span class="thumb"><GameIcon :slug="game.slug" /></span>
        <strong>{{ t(game.titleKey) }}</strong>
        <small>{{ scoreLabel(game) }}</small>
      </RouterLink>
    </main>

  </div>
</template>

<style scoped>
.home {
  padding: 20px 16px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.home-header h1 {
  font-size: 24px;
}

.header-links {
  display: flex;
  gap: 14px;
  font-size: 22px;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 6px 10px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
  text-align: center;
}

.thumb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  font-size: 30px;
  background: #fff8e1;
  border-radius: 12px;
  margin-bottom: 2px;
}

.game-card strong {
  font-size: 13px;
  line-height: 1.25;
  word-break: keep-all;
}

/* 서버에서 순위가 도착하기 전에도 카드 높이가 같도록 한 줄을 비워둔다 */
.game-card small {
  font-size: 11px;
  line-height: 14px;
  min-height: 14px;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #bcaaa4;
}
</style>
