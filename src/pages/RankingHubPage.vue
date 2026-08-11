<script setup lang="ts">
import { onMounted } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { prevMonthLabel } from '@/shared/rankPeriod'
import { rankedGames, refreshPopularity } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

const hallMonth = prevMonthLabel()

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

    <!-- 지난달 시상식 입구 — 목록 위 한 줄. 여기만 금빛을 써서 문이라는 것을 알린다 -->
    <RouterLink class="hall-entry" to="/ranking/hall">
      <span class="hall-crown"><UiIcon name="crown" /></span>
      <span class="hall-text">
        <strong>{{ t('hall.entry') }}</strong>
        <small>{{ t('hall.period', { y: hallMonth.y, m: hallMonth.m }) }}</small>
      </span>
      <UiIcon name="chevron" />
    </RouterLink>

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

/* 명예의 전당 입구 — 홈 추천 칸과 같은 금빛 계열로, 아래 목록과 결이 갈린다 */
.hall-entry {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 14px;
  padding: 12px 12px 12px 14px;
  border: 1.5px solid #f2ba62;
  border-radius: 14px;
  background: linear-gradient(158deg, #fff6e2, #ffe8bf);
  transition: transform 0.1s ease;
}

.hall-entry:active {
  transform: scale(0.985);
}

.hall-crown {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.75);
  color: #e8a812;
}

.hall-crown svg {
  width: 20px;
  height: 20px;
}

.hall-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hall-text strong {
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.hall-text small {
  font-size: 12px;
  font-weight: 700;
  color: #b06c1f;
}

/* UiIcon은 놓이는 자리가 크기를 정한다 — 안 주면 줄을 통째로 채운다 */
.hall-entry > svg {
  flex: none;
  width: 18px;
  height: 18px;
  color: #c69245;
}

/* 홈 추천 칸과 같은 규칙 — 결은 두고 명도만 내린다 */
[data-theme='dark'] .hall-entry {
  border-color: #7a5a22;
  background: linear-gradient(158deg, #3a2c17, #2c2114);
}

[data-theme='dark'] .hall-crown {
  background: rgb(255 213 130 / 0.14);
}

[data-theme='dark'] .hall-text small {
  color: #e6a94f;
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
