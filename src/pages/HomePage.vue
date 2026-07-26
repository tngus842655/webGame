<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import {
  featuredSlugs,
  fetchMyStats,
  getLocalBest,
  popularityRanks,
  refreshPopularity,
  sortByPopularity,
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

// 1~3위만 메달로 꾸민다
function rankClass(rank: number): string {
  return rank <= 3 ? `medal m${rank}` : ''
}

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
        <RouterLink v-if="isAdmin" to="/admin" :aria-label="t('admin.title')">🛠️</RouterLink>
        <RouterLink to="/settings" :aria-label="t('settings.title')">⚙️</RouterLink>
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
          <RouterLink
            v-for="game in shelf.games"
            :key="game.slug"
            class="game-card"
            :to="`/play/${game.slug}`"
          >
            <span v-if="game.rank !== null" class="rank" :class="rankClass(game.rank)">
              {{ game.rank }}
            </span>
            <span class="thumb"><GameIcon :slug="game.slug" /></span>
            <strong>{{ t(game.titleKey) }}</strong>
            <small>{{ scoreLabel(game) }}</small>
          </RouterLink>
        </div>
      </section>
    </main>

    <RouterLink v-if="trashCount > 0" class="trash-entry" to="/trash">
      <span>🗑️ {{ t('trash.title') }}</span>
      <span class="count">{{ trashCount }} ›</span>
    </RouterLink>
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

/* 칸마다 테두리 색을 달리하고, 제목표를 윗선에 걸쳐 놓는다 */
.shelf {
  position: relative;
  padding: 20px 12px 14px;
  margin-bottom: 20px;
  border: 2px solid;
  border-radius: 20px;
}

.shelf h2 {
  position: absolute;
  top: -12px;
  left: 14px;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 0.02em;
  color: #fff;
}

.fresh {
  border-color: #66bb6a;
  background: rgb(232 245 233 / 0.75);
}

.fresh h2 {
  background: #43a047;
}

.popular {
  border-color: #ffb74d;
  background: rgb(255 243 224 / 0.8);
}

.popular h2 {
  background: #ef6c00;
}

.more {
  border-color: #d7ccc8;
  background: rgb(255 255 255 / 0.45);
}

.more h2 {
  background: #8d6e63;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.game-card {
  position: relative;
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

/* 카드 크기는 그대로 두고 왼쪽 위 여백에 얹는다 */
.game-card .rank {
  position: absolute;
  top: 5px;
  left: 5px;
  display: grid;
  place-items: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border-radius: 999px;
  background: #f3eeec;
  color: #a1887f;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

/* 1~3위는 메달로 */
.game-card .rank.medal {
  color: #fff;
  font-size: 13px;
  text-shadow: 0 1px 1px rgb(0 0 0 / 0.2);
}

.game-card .rank.m1 {
  background: linear-gradient(#ffd54f, #f9a825);
  box-shadow: 0 2px 6px rgb(249 168 37 / 0.5);
}

.game-card .rank.m2 {
  background: linear-gradient(#eceff1, #b0bec5);
  box-shadow: 0 2px 6px rgb(120 144 156 / 0.4);
}

.game-card .rank.m3 {
  background: linear-gradient(#d9a679, #b07d4e);
  box-shadow: 0 2px 6px rgb(141 110 99 / 0.4);
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

.trash-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-top: 14px;
  background: rgb(255 255 255 / 0.6);
  border-radius: 14px;
  font-size: 14px;
  color: #8d6e63;
}

.trash-entry .count {
  color: #bcaaa4;
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
