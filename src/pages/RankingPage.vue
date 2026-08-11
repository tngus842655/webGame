<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { GAMES } from '@/games/registry'
import { getCurrentUserId } from '@/shared/auth'
import { t } from '@/shared/i18n'
import { formatRankRange, thisMonthRange, thisWeekRange } from '@/shared/rankPeriod'
import { fetchLeaderboard, type LeaderboardEntry } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

const route = useRoute()
const slug = String(route.params.slug)
const game = GAMES.find((g) => g.slug === slug)

// 점수가 아니라 단계로 겨루는 게임은 숫자 옆에 단위를 붙인다 (registry의 recordUnit)
function record(value: number): string {
  const n = value.toLocaleString()
  return game?.recordUnit === 'stage' ? t('rank.stage', { n }) : n
}

// 여기까지가 상위권. 1~3위는 금·은·동을 두르고, 10위까지는 번호와 글자를 한 톤 올린다.
const TOP_TIER = 10

const period = ref<'week' | 'month'>('week')

// 탭 이름만으로는 구간이 정확히 어디서 끊기는지 안 보인다 — 날짜로 적어 준다
const caption = computed(() =>
  formatRankRange(period.value === 'week' ? thisWeekRange() : thisMonthRange()),
)

const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const failed = ref(false)
const myUserId = ref<string | null>(null)

async function load() {
  loading.value = true
  failed.value = false
  try {
    entries.value = await fetchLeaderboard(slug, period.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  myUserId.value = await getCurrentUserId()
  await load()
})
watch(period, load)
</script>

<template>
  <div class="ranking">
    <header class="ranking-header">
      <RouterLink class="back" to="/ranking"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('ranking.title', { name: game ? t(game.titleKey) : t('ranking.unknown') }) }}</h1>
    </header>

    <div class="tabs">
      <button type="button" :class="{ active: period === 'week' }" @click="period = 'week'">
        {{ t('ranking.week') }}
      </button>
      <button type="button" :class="{ active: period === 'month' }" @click="period = 'month'">
        {{ t('ranking.month') }}
      </button>
    </div>
    <p class="caption">{{ caption }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="entries.length === 0" class="notice">{{ t('ranking.empty') }}</p>
    <ol v-else class="board">
      <li
        v-for="(entry, i) in entries"
        :key="entry.user_id"
        :class="[i < 3 ? `m${i + 1}` : '', { top: i < TOP_TIER, me: entry.user_id === myUserId }]"
      >
        <span class="rank">{{ i + 1 }}</span>
        <span class="name">{{ entry.nickname }}</span>
        <span class="score">{{ record(entry.best_score) }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.ranking {
  padding: 20px 16px;
}

.ranking-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ranking-header h1 {
  font-size: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.caption {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--ink-faint);
}

.tabs button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink-faint);
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.board {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border-radius: 12px;
}

/* 1~3위는 줄 자체가 금·은·동을 띤다 (홈의 인기 카드와 같은 결).
   1위만 그림자를 얹어 한 칸 앞으로 나오게 한다 — 순서를 색만으로 읽기는 어렵다. */
.board li.m1 {
  background: linear-gradient(168deg, #fffbf0, #fff1d2);
  outline: 2px solid #e3b35a;
  outline-offset: -2px;
  box-shadow: var(--shadow-raise);
}

.board li.m2 {
  background: linear-gradient(168deg, #fdfefe, #edf1f4);
  outline: 1.5px solid #bfc7cd;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-card);
}

.board li.m3 {
  background: linear-gradient(168deg, #fff9f3, #f7e6d7);
  outline: 1.5px solid #d3a077;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-card);
}

/* 금빛 판은 어두운 화면에서 혼자 밝게 뜬다. 결은 그대로 두고 명도만 내린다. */
[data-theme='dark'] .board li.m1 {
  background: linear-gradient(168deg, #3b3019, #2e2617);
  outline-color: #8a6a26;
}

[data-theme='dark'] .board li.m2 {
  background: linear-gradient(168deg, #333739, #272b2d);
  outline-color: #5c6369;
}

[data-theme='dark'] .board li.m3 {
  background: linear-gradient(168deg, #392b21, #2c211a);
  outline-color: #7c5837;
}

/* 11위부터는 한 줄 띄워 상위권과 갈린다 — 따로 문구를 붙이지 않고 자리로만 알린다 */
.board li.top + li:not(.top) {
  margin-top: 10px;
}

/* 내 기록은 어디에 있든 이 초록으로 찾는다. 메달 테두리를 이겨야 하므로 뒤에 두고,
   어두운 테마의 메달 규칙과도 무게를 맞춘다. */
.board li.me,
[data-theme='dark'] .board li.me {
  outline: 2px solid #43a047;
}

.rank {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--ink-faint);
}

/* 상위 10위 — 번호에 판을 깔고 이름·점수를 진하게. --press는 두 테마 모두에서
   바탕보다 한 겹 도드라지는 값이라 여기 그대로 쓴다. */
.board li.top .rank {
  background: var(--press);
  color: var(--ink-body);
}

.board li.top .name {
  font-weight: 700;
  color: var(--ink);
}

.board li.top .score {
  color: var(--ink);
}

/* 메달 번호는 두 테마에서 같은 색을 쓴다 — 금·은·동은 고유색이다 */
.board li.m1 .rank {
  background: linear-gradient(#ffe9a8, #f2c65a);
  color: #6b4e0d;
}

.board li.m2 .rank {
  background: linear-gradient(#f4f7f9, #d2d9de);
  color: #4a555c;
}

.board li.m3 .rank {
  background: linear-gradient(#f7dcc5, #e0b088);
  color: #7a4a22;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  font-weight: bold;
}
</style>
