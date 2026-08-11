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

// 인기 1~3위만 금·은·동을 두른다. 순위가 없는 게임(rank가 null)은 해당 없다.
function medal(rank: number | null): string {
  return rank !== null && rank <= 3 ? `m${rank}` : ''
}

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
        <RouterLink class="row" :class="medal(game.rank)" :to="`/ranking/${game.slug}`">
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

/* 인기 1~3위는 줄 자체가 금·은·동을 띤다 (게임별 랭킹 화면과 같은 색).
   :active보다 뒤에 둬서 눌러도 메달색이 유지된다 — 눌린 느낌은 크기로 준다. */
.row.m1 {
  background: linear-gradient(168deg, #fffbf0, #fff1d2);
  outline: 2px solid #e3b35a;
  outline-offset: -2px;
  box-shadow: var(--shadow-raise);
}

.row.m2 {
  background: linear-gradient(168deg, #fdfefe, #edf1f4);
  outline: 1.5px solid #bfc7cd;
  outline-offset: -1.5px;
}

.row.m3 {
  background: linear-gradient(168deg, #fff9f3, #f7e6d7);
  outline: 1.5px solid #d3a077;
  outline-offset: -1.5px;
}

/* 금빛 판은 어두운 화면에서 혼자 밝게 뜬다. 결은 그대로 두고 명도만 내린다. */
[data-theme='dark'] .row.m1 {
  background: linear-gradient(168deg, #3b3019, #2e2617);
  outline-color: #8a6a26;
}

[data-theme='dark'] .row.m2 {
  background: linear-gradient(168deg, #333739, #272b2d);
  outline-color: #5c6369;
}

[data-theme='dark'] .row.m3 {
  background: linear-gradient(168deg, #392b21, #2c211a);
  outline-color: #7c5837;
}

/* 인기 순위. 두 자리로 넘어가도 아래 줄과 어긋나지 않게 자릿수 폭을 고정한다.
   메달이 붙지 않는 4위 아래도 같은 크기의 자리를 차지해 번호가 세로로 맞는다. */
.rank {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--ink-muted);
}

/* 메달 번호는 두 테마에서 같은 색을 쓴다 — 금·은·동은 고유색이다 */
.row.m1 .rank {
  background: linear-gradient(#ffe9a8, #f2c65a);
  color: #6b4e0d;
}

.row.m2 .rank {
  background: linear-gradient(#f4f7f9, #d2d9de);
  color: #4a555c;
}

.row.m3 .rank {
  background: linear-gradient(#f7dcc5, #e0b088);
  color: #7a4a22;
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
