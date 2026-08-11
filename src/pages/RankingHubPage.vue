<script setup lang="ts">
import { onMounted } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { rankedGames, refreshPopularity } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

// 홈과 달리 신규를 앞에 세우지 않는다 — 번호를 밝히는 화면이라 1번 자리에는 인기 1위가 서야 한다.
// 캐시로 첫 렌더부터 확정하고, 새 값은 다음 진입에 반영한다.
const games = rankedGames(GAMES)

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
          <!-- 최근 7일 기록이 없는 게임은 매길 순위가 없다 — 자리만 지킨다 -->
          <span class="rank">{{ game.rank ?? '–' }}</span>
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
  padding: 11px 12px;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
  transition: transform 0.1s ease;
}

.row:active {
  transform: scale(0.985);
  background: var(--surface-press);
}

/* 인기 순위. 두 자리로 넘어가도 아래 줄과 어긋나지 않게 자릿수 폭을 고정한다 */
.rank {
  flex-shrink: 0;
  width: 22px;
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  text-align: center;
  color: var(--ink-muted);
}

.thumb {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.title {
  flex: 1;
  font-weight: 700;
  color: var(--ink);
}

.arrow {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--ink-faint);
}
</style>
