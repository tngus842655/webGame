<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameCard from '@/shared/GameCard.vue'
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'
import {
  featuredSlugs,
  fetchMyStats,
  getLocalBest,
  popularityRanks,
  refreshPopularity,
  sortByPopularity,
  syncLocalBests,
  trashedGames,
  type MyGameStat,
} from '@/shared/scores'
import { ensureAdminChecked, fetchGameFlags, isAdmin } from '@/shared/admin'

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

// 카드 순서는 캐시된 인기순으로 처음부터 확정하고, 서버 응답으로는 내 기록만 채운다.
// 순위 숫자도 같은 캐시에서 나온다 — 아직 기록이 없는 게임은 숫자가 없다.
const ranks = popularityRanks(GAMES)
const cards = ref(
  sortByPopularity(GAMES).map((game) => ({
    ...game,
    rank: ranks.get(game.slug) ?? null,
    best: getLocalBest(game.slug),
    stat: null as MyGameStat | null,
  })),
)

// 세 칸으로 나눈다 — 인기 1~3위, 신규(관리자가 올린 것), 그 아래 전부.
// sortByPopularity가 이미 신규를 앞에 세워두므로 여기서는 가르기만 한다.
const featured = featuredSlugs()
const fresh = computed(() => cards.value.filter((card) => featured.has(card.slug)))
const ranked = computed(() => cards.value.filter((card) => !featured.has(card.slug)))

const shelves = computed(() => [
  { key: 'popular', title: t('home.sectionPopular'), games: ranked.value.slice(0, 3) },
  { key: 'fresh', title: t('home.sectionNew'), games: fresh.value },
  { key: 'more', title: t('home.sectionMore'), games: ranked.value.slice(3) },
])

// 휴지통에 아무것도 없으면 입구를 만들지 않는다
const trashCount = trashedGames(GAMES).length

onMounted(async () => {
  // 노출 설정·인기도는 캐시에 담아두고 다음 진입부터 반영한다 (보는 도중 카드가 움직이지 않도록)
  void fetchGameFlags().catch(() => {})
  void ensureAdminChecked()
  const [, myStats] = await Promise.all([
    refreshPopularity(),
    fetchMyStats().catch(() => [] as MyGameStat[]),
  ])
  // 서버 기록을 로컬에 되먹인다 — 안 하면 플레이 화면의 최고 기록이 이 기기 값에 머문다
  syncLocalBests(myStats)
  const statBySlug = new Map(myStats.map((stat) => [stat.game_slug, stat]))
  cards.value = cards.value.map((card) => ({ ...card, stat: statBySlug.get(card.slug) ?? null }))
})
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>{{ t('app.title') }}</h1>
      <nav class="header-links">
        <RouterLink to="/ranking" :aria-label="t('home.ranking')"><UiIcon name="trophy" /></RouterLink>
        <RouterLink v-if="isAdmin" to="/admin" :aria-label="t('admin.title')">
          <UiIcon name="wrench" />
        </RouterLink>
        <RouterLink to="/settings" :aria-label="t('settings.title')"><UiIcon name="gear" /></RouterLink>
      </nav>
    </header>

    <main>
      <section
        v-for="shelf in shelves"
        v-show="shelf.games.length > 0"
        :key="shelf.key"
        class="shelf"
        :class="shelf.key"
      >
        <h2>{{ shelf.title }}</h2>
        <div class="game-grid">
          <GameCard
            v-for="game in shelf.games"
            :key="game.slug"
            :slug="game.slug"
            :title-key="game.titleKey"
            :rank="game.rank"
            :label="scoreLabel(game)"
          />
        </div>
      </section>
    </main>

    <RouterLink v-if="trashCount > 0" class="trash-entry" to="/trash">
      <span class="trash-label"><UiIcon name="trash" />{{ t('trash.title') }}</span>
      <span class="count">{{ trashCount }}<UiIcon name="chevron" /></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.home {
  padding: 18px 16px 24px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.home-header h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #4e342e;
}

/* 이모지 링크였을 때는 기기마다 크기가 제각각이고 과녁도 작았다 */
.header-links {
  display: flex;
  gap: 6px;
}

.header-links a {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: #8d6e63;
  transition: background-color 0.12s ease;
}

.header-links a:active {
  background: rgb(93 64 55 / 0.1);
}

.header-links svg {
  width: 23px;
  height: 23px;
}

/* 칸마다 테두리 색을 달리하고, 제목표를 윗선에 걸쳐 놓는다 */
.shelf {
  position: relative;
  padding: 22px 12px 14px;
  margin-bottom: 22px;
  border: 2px solid;
  border-radius: 22px;
}

.shelf h2 {
  position: absolute;
  top: -12px;
  left: 14px;
  padding: 4px 13px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
}

.fresh {
  border-color: #66bb6a;
  background: rgb(232 245 233 / 0.75);
}

.fresh h2 {
  background: #43a047;
  box-shadow: 0 2px 6px rgb(67 160 71 / 0.35);
}

.popular {
  border-color: #ffb74d;
  background: rgb(255 243 224 / 0.8);
}

.popular h2 {
  background: #ef6c00;
  box-shadow: 0 2px 6px rgb(239 108 0 / 0.32);
}

.more {
  border-color: #d7ccc8;
  background: rgb(255 255 255 / 0.45);
}

.more h2 {
  background: #8d6e63;
  box-shadow: 0 2px 6px rgb(141 110 99 / 0.3);
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.trash-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 14px 16px;
  background: rgb(255 255 255 / 0.6);
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  color: #8d6e63;
}

.trash-entry:active {
  background: rgb(255 255 255 / 0.9);
}

.trash-label,
.trash-entry .count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trash-entry .count {
  gap: 2px;
  color: #bcaaa4;
}

.trash-label svg {
  width: 18px;
  height: 18px;
}

.trash-entry .count svg {
  width: 16px;
  height: 16px;
}

</style>
