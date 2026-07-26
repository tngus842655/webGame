<script setup lang="ts">
// 사용자용 휴지통 — 주 목록에서 내려간 게임을 계속 즐길 수 있게 모아둔다.
// 관리자가 숨김까지 건 게임은 여기서도 빠진다.
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { getLocalBest, popularityRanks, trashedGames } from '@/shared/scores'

// 순위는 홈과 같은 기준으로 매긴다 — 그래서 홈에서 비어 보이는 번호가 여기에 있다
const ranks = popularityRanks()
const cards = trashedGames(GAMES).map((game) => ({
  ...game,
  rank: ranks.get(game.slug) ?? null,
  best: getLocalBest(game.slug),
}))
</script>

<template>
  <div class="trash">
    <header class="trash-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ t('trash.title') }}</h1>
    </header>

    <p class="hint">{{ t('trash.hint') }}</p>

    <p v-if="cards.length === 0" class="notice">{{ t('trash.empty') }}</p>
    <main v-else class="game-grid">
      <RouterLink
        v-for="game in cards"
        :key="game.slug"
        class="game-card"
        :to="`/play/${game.slug}`"
      >
        <span v-if="game.rank !== null" class="rank">{{ game.rank }}</span>
        <span class="thumb"><GameIcon :slug="game.slug" /></span>
        <strong>{{ t(game.titleKey) }}</strong>
        <small>{{ game.best === null ? '' : t('home.best', { n: game.best.toLocaleString() }) }}</small>
      </RouterLink>
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

.back {
  font-size: 22px;
  padding: 4px 8px;
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

/* 홈과 같은 자리 — 카드 크기는 그대로 두고 왼쪽 위 여백에 얹는다 */
.rank {
  position: absolute;
  top: 6px;
  left: 8px;
  font-size: 11px;
  font-weight: bold;
  color: #d7ccc8;
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
