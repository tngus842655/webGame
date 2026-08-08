<script setup lang="ts">
// 운영자 전용 — 게임 화면에서 받은 좋아요·싫어요를 기간별로 본다.
// 기간의 축은 vote_day(누른 기기의 시간대 기준 날짜)다. 달력을 자르는 규칙은
// 통계 화면과 함께 쓴다(adminPeriod.ts) — 같은 날 두 화면의 '이번주'가 어긋나면
// 숫자를 견줄 수가 없다.
import { computed, onMounted, ref, watch } from 'vue'
import {
  formatPeriodCaption,
  HALVES,
  type Half,
  type Period,
  PERIODS,
  periodRange,
} from '@/shared/adminPeriod'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { fetchVoteStats, type VoteStat } from '@/shared/gameVotes'
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

// 통계 화면과 달리 이 화면만의 선택이다 — 셋이 묶여 다니는 통계와 달리 혼자 서 있다
const period = ref<Period>('daily')
const half = ref<Half>('curr')

// 기간을 옮기면 진행 중인 쪽부터 보여준다 (오늘·이번주·이번달)
watch(period, () => {
  half.value = 'curr'
})

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// vote_day 기준 양끝 포함 구간. 누적은 양끝을 비운다
const range = computed<{ start: string | null; end: string | null }>(() => {
  const days = periodRange(period.value, half.value)
  if (!days) return { start: null, end: null }
  return { start: fmt(days.first), end: fmt(days.last) }
})

const caption = computed(() => formatPeriodCaption(periodRange(period.value, half.value)))

const stats = ref<VoteStat[]>([])
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await fetchVoteStats(range.value.start, range.value.end)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(range, load)

// 정렬 — 좋아요·싫어요 중 한 축을 고르고, 같은 축을 다시 누르면 방향이 뒤집힌다.
// 처음은 많은 순이다 (적은 순이 필요한 날보다 많은 순을 보는 날이 훨씬 많다).
const sortKey = ref<'up' | 'down'>('up')
const asc = ref(false)

function setSort(key: 'up' | 'down') {
  if (sortKey.value === key) asc.value = !asc.value
  else {
    sortKey.value = key
    asc.value = false
  }
}

// 투표가 있는 게임만 온다 (RPC가 group by로 걸러 준다)
const rows = computed(() => {
  const key = sortKey.value
  const other = key === 'up' ? 'down' : 'up'
  return [...stats.value].sort((a, b) => {
    const diff = asc.value ? a[key] - b[key] : b[key] - a[key]
    // 같은 값이면 반대쪽 표가 적은 쪽을 앞에 — '좋아요 3'끼리는 덜 미움받는 쪽이 먼저다
    return diff || a[other] - b[other] || a.slug.localeCompare(b.slug)
  })
})

const TITLES = new Map(GAMES.map((game) => [game.slug, game.titleKey]))

// 코드에서 이미 지운 게임의 표가 남아 있을 수 있다 — 슬러그라도 보여준다
function gameName(slug: string): string {
  const key = TITLES.get(slug)
  return key ? t(key) : slug
}

function pct(n: number, total: number): string {
  return `${(n / total) * 100}%`
}
</script>

<template>
  <div class="votes">
    <header class="page-header">
      <RouterLink class="back" to="/admin"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('admin.votes') }}</h1>
    </header>

    <div class="tabs">
      <button
        v-for="p in PERIODS"
        :key="p.key"
        type="button"
        :class="{ active: period === p.key }"
        @click="period = p.key"
      >
        {{ t(p.labelKey) }}
      </button>
    </div>

    <div v-if="period !== 'all'" class="tabs halves">
      <button type="button" :class="{ active: half === 'prev' }" @click="half = 'prev'">
        {{ t(HALVES[period][0]) }}
      </button>
      <button type="button" :class="{ active: half === 'curr' }" @click="half = 'curr'">
        {{ t(HALVES[period][1]) }}
      </button>
    </div>

    <div class="list-head">
      <small v-if="caption" class="caption">{{ caption }}</small>
      <div class="sort">
        <button
          v-for="key in ['up', 'down'] as const"
          :key="key"
          type="button"
          class="sort-btn"
          :class="[key, { active: sortKey === key }]"
          @click="setSort(key)"
        >
          <UiIcon :name="key === 'up' ? 'arrow-up' : 'arrow-down'" />
          {{ t(key === 'up' ? 'admin.votesUp' : 'admin.votesDown') }}
          <span v-if="sortKey === key" class="dir">{{ asc ? '▲' : '▼' }}</span>
        </button>
      </div>
    </div>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="rows.length === 0" class="notice">{{ t('admin.votesEmpty') }}</p>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.slug" class="row">
        <span class="thumb"><GameIcon :slug="row.slug" /></span>
        <div class="info">
          <div class="title-line">
            <strong>{{ gameName(row.slug) }}</strong>
            <span class="counts">
              <span class="count up"><UiIcon name="arrow-up" />{{ row.up.toLocaleString() }}</span>
              <span class="count down">
                <UiIcon name="arrow-down" />{{ row.down.toLocaleString() }}
              </span>
            </span>
          </div>
          <div class="bar">
            <span class="seg up" :style="{ width: pct(row.up, row.up + row.down) }" />
            <span class="seg down" :style="{ width: pct(row.down, row.up + row.down) }" />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.votes {
  padding: 20px 16px 32px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h1 {
  font-size: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.tabs button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink-faint);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
}

/* 기간 탭과 한 묶음으로 읽히도록 붙여 둔다 */
.halves {
  margin-top: -6px;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.caption {
  font-size: 12px;
  color: var(--ink-faint);
}

.sort {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-faint);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sort-btn svg {
  width: 13px;
  height: 13px;
}

.sort-btn.active {
  font-weight: bold;
}

.sort-btn.up.active {
  border-color: #43a047;
  color: #2e7d32;
}

.sort-btn.down.active {
  border-color: #e57368;
  color: #d0453f;
}

.dir {
  font-size: 9px;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border-radius: 14px;
}

.thumb {
  flex: none;
  width: 34px;
  height: 34px;
}

.info {
  flex: 1;
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.title-line strong {
  overflow: hidden;
  font-size: 14.5px;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.counts {
  display: flex;
  flex: none;
  gap: 10px;
}

.count {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  font-weight: bold;
}

.count svg {
  width: 13px;
  height: 13px;
}

.count.up {
  color: #2e7d32;
}

.count.down {
  color: #d0453f;
}

.bar {
  display: flex;
  height: 6px;
  margin-top: 7px;
  border-radius: 3px;
  background: var(--line);
  overflow: hidden;
}

.seg {
  height: 100%;
}

.seg.up {
  background: #43a047;
}

.seg.down {
  background: #e57368;
}
</style>
