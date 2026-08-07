<script setup lang="ts">
// 운영자 전용 — 리워드 광고를 어디서 부르고 어떻게 끝나는지.
// AdMob 콘솔에는 광고 단위 하나로 뭉쳐 있어 게임별·자리별로 안 쪼개진다.
import { computed, onMounted, ref, watch } from 'vue'
import type { AdMedium } from '@/shared/ads'
import { fetchAdStats, type AdStat } from '@/shared/adViews'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t, type TranslationKey } from '@/shared/i18n'
import { STATS_PERIODS, statsDays } from '@/shared/playSessions'
import UiIcon from '@/shared/UiIcon.vue'

const stats = ref<AdStat[]>([])
const loading = ref(true)
const failed = ref(false)
const medium = ref<AdMedium | 'all'>('all')

async function load() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await fetchAdStats(statsDays.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(statsDays, load)

const MEDIUM_LABELS: Record<AdMedium, TranslationKey> = {
  adsense: 'stats.adWeb',
  admob: 'stats.adAndroid',
  toss: 'stats.adToss',
}

// 실제로 기록이 있는 매체만. 하나뿐이면 갈라 볼 것이 없어 필터를 감춘다
const mediums = computed(() =>
  (Object.keys(MEDIUM_LABELS) as AdMedium[]).filter((m) =>
    stats.value.some((row) => row.medium === m),
  ),
)

// 기간을 바꾸면 고른 매체가 그 기간에 없을 수 있다
watch(mediums, (list) => {
  if (medium.value !== 'all' && !list.includes(medium.value)) medium.value = 'all'
})

const rows = computed(() =>
  medium.value === 'all' ? stats.value : stats.value.filter((row) => row.medium === medium.value),
)

type Spot = Omit<AdStat, 'medium'>

// 전체를 볼 때는 같은 자리가 매체 수만큼 나뉘어 온다 — 자리 단위로 먼저 합친다
const spots = computed(() => {
  const bySpot = new Map<string, Spot>()
  for (const row of rows.value) {
    const prev = bySpot.get(`${row.slug} ${row.placement}`)
    if (prev) {
      prev.viewed += row.viewed
      prev.dismissed += row.dismissed
      prev.unavailable += row.unavailable
      prev.total += row.total
      continue
    }
    bySpot.set(`${row.slug} ${row.placement}`, {
      slug: row.slug,
      placement: row.placement,
      viewed: row.viewed,
      dismissed: row.dismissed,
      unavailable: row.unavailable,
      total: row.total,
    })
  }
  return [...bySpot.values()]
})

// (게임, 자리) 줄을 게임 단위로 묶는다
const games = computed(() => {
  const byGame = new Map<
    string,
    { slug: string; viewed: number; dismissed: number; unavailable: number; total: number; spots: Spot[] }
  >()
  for (const row of spots.value) {
    let game = byGame.get(row.slug)
    if (!game) {
      game = { slug: row.slug, viewed: 0, dismissed: 0, unavailable: 0, total: 0, spots: [] }
      byGame.set(row.slug, game)
    }
    game.viewed += row.viewed
    game.dismissed += row.dismissed
    game.unavailable += row.unavailable
    game.total += row.total
    game.spots.push(row)
  }
  return [...byGame.values()].sort((a, b) => b.total - a.total)
})

const totals = computed(() =>
  rows.value.reduce(
    (acc, row) => ({
      viewed: acc.viewed + row.viewed,
      unavailable: acc.unavailable + row.unavailable,
      total: acc.total + row.total,
    }),
    { viewed: 0, unavailable: 0, total: 0 },
  ),
)

const TITLES = new Map(GAMES.map((game) => [game.slug, game.titleKey]))

function gameName(slug: string): string {
  const key = TITLES.get(slug)
  return key ? t(key) : slug
}

// placement는 <slug>-<동작>이라 게임 이름 아래에서는 뒤쪽만 있으면 된다
function spotName(slug: string, placement: string): string {
  return placement.startsWith(`${slug}-`) ? placement.slice(slug.length + 1) : placement
}

function pct(n: number, total: number): string {
  return `${(n / total) * 100}%`
}
</script>

<template>
  <div class="ads">
    <header class="page-header">
      <RouterLink class="back" to="/stats"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('stats.adsTitle') }}</h1>
    </header>

    <div class="tabs">
      <button
        v-for="p in STATS_PERIODS"
        :key="p"
        type="button"
        :class="{ active: statsDays === p }"
        @click="statsDays = p"
      >
        {{ t('stats.days', { n: p }) }}
      </button>
    </div>

    <!-- 매체가 하나뿐이면 전체와 같은 값이라 갈라 볼 것이 없다 -->
    <div v-if="mediums.length > 1" class="tabs mediums">
      <button type="button" :class="{ active: medium === 'all' }" @click="medium = 'all'">
        {{ t('stats.adAll') }}
      </button>
      <button
        v-for="m in mediums"
        :key="m"
        type="button"
        :class="{ active: medium === m }"
        @click="medium = m"
      >
        {{ t(MEDIUM_LABELS[m]) }}
      </button>
    </div>

    <p class="hint">{{ t('stats.adsHint') }}</p>

    <section class="summary">
      <div class="summary-item">
        <strong>{{ totals.total.toLocaleString() }}</strong>
        <small>{{ t('stats.adCalls') }}</small>
      </div>
      <div class="summary-item">
        <strong>{{ totals.viewed.toLocaleString() }}</strong>
        <small>{{ t('stats.adViewed') }}</small>
      </div>
      <div class="summary-item">
        <strong>{{ totals.unavailable.toLocaleString() }}</strong>
        <small>{{ t('stats.adUnavailable') }}</small>
      </div>
    </section>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="games.length === 0" class="notice">{{ t('stats.adsEmpty') }}</p>
    <ul v-else class="list">
      <li v-for="game in games" :key="game.slug" class="card">
        <div class="head">
          <span class="thumb"><GameIcon :slug="game.slug" /></span>
          <div class="info">
            <div class="title-line">
              <strong>{{ gameName(game.slug) }}</strong>
              <span class="count">{{ game.total.toLocaleString() }}</span>
            </div>
            <!-- 초록 시청 · 회색 닫음 · 주황 못 뜸 -->
            <div class="bar">
              <span class="seg viewed" :style="{ width: pct(game.viewed, game.total) }" />
              <span class="seg dismissed" :style="{ width: pct(game.dismissed, game.total) }" />
              <span class="seg unavailable" :style="{ width: pct(game.unavailable, game.total) }" />
            </div>
            <small class="metrics">
              {{ t('stats.adViewed') }} {{ game.viewed.toLocaleString() }} ·
              {{ t('stats.adDismissed') }} {{ game.dismissed.toLocaleString() }} ·
              {{ t('stats.adUnavailable') }} {{ game.unavailable.toLocaleString() }}
            </small>
          </div>
        </div>

        <!-- 자리가 하나뿐이면 위 줄과 같은 값이라 갈라 볼 것이 없다 -->
        <ul v-if="game.spots.length > 1" class="spots">
          <li v-for="spot in game.spots" :key="spot.placement">
            <div class="title-line">
              <span class="spot-name">{{ spotName(game.slug, spot.placement) }}</span>
              <span class="count">{{ spot.total.toLocaleString() }}</span>
            </div>
            <div class="bar">
              <span class="seg viewed" :style="{ width: pct(spot.viewed, spot.total) }" />
              <span class="seg dismissed" :style="{ width: pct(spot.dismissed, spot.total) }" />
              <span class="seg unavailable" :style="{ width: pct(spot.unavailable, spot.total) }" />
            </div>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ads {
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
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
}

/* 기간 탭과 한 묶음으로 읽히도록 붙여 둔다 */
.mediums {
  margin-top: -6px;
}

.hint {
  margin-bottom: 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-faint);
  word-break: keep-all;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 14px 6px;
  background: var(--surface);
  border-radius: 14px;
}

.summary-item strong {
  font-size: 17px;
  color: var(--ink-body);
}

.summary-item small {
  font-size: 11px;
  color: var(--ink-faint);
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

.card {
  background: var(--surface);
  border-radius: 14px;
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
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

.count {
  flex: none;
  font-size: 13px;
  font-weight: bold;
  color: var(--ink-body);
}

.bar {
  display: flex;
  height: 6px;
  margin: 6px 0 5px;
  border-radius: 3px;
  background: var(--line);
  overflow: hidden;
}

.seg {
  height: 100%;
}

.seg.viewed {
  background: #43a047;
}

.seg.dismissed {
  background: var(--ink-faint);
}

/* 광고가 안 뜬 몫 — 재고 문제라 눈에 걸려야 한다 */
.seg.unavailable {
  background: #f9a825;
}

.metrics {
  display: block;
  font-size: 11px;
  color: var(--ink-faint);
}

.spots {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 14px;
  padding: 11px 0 13px;
  border-top: 1px solid var(--line-soft);
}

.spot-name {
  overflow: hidden;
  font-size: 13px;
  color: var(--ink-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spots .bar {
  margin: 5px 0 0;
}

.spots .count {
  font-size: 12px;
}
</style>
