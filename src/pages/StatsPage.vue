<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { fetchGameStats, type GameStat } from '@/shared/playSessions'

const PERIODS = [1, 7, 30] as const

const days = ref<number>(7)
const stats = ref<GameStat[]>([])
const loading = ref(true)
const failed = ref(false)

const rows = computed(() => {
  const bySlug = new Map(stats.value.map((s) => [s.game_slug, s]))
  return GAMES.map((game) => ({
    slug: game.slug,
    titleKey: game.titleKey,
    stat: bySlug.get(game.slug) ?? null,
  })).sort((a, b) => (b.stat?.total_seconds ?? 0) - (a.stat?.total_seconds ?? 0))
})

const totals = computed(() => {
  return stats.value.reduce(
    (acc, s) => ({
      plays: acc.plays + s.plays,
      seconds: acc.seconds + s.total_seconds,
      players: Math.max(acc.players, s.players),
    }),
    { plays: 0, seconds: 0, players: 0 },
  )
})

const maxSeconds = computed(() => Math.max(1, ...stats.value.map((s) => s.total_seconds)))

async function load() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await fetchGameStats(days.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(days, load)

// 초 → "1시간 23분" / "12분 30초" / "45초"
function duration(sec: number): string {
  if (sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}${t('stats.hour')} ${m}${t('stats.minute')}`
  if (m > 0) return `${m}${t('stats.minute')} ${s}${t('stats.second')}`
  return `${s}${t('stats.second')}`
}
</script>

<template>
  <div class="stats">
    <header class="stats-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ t('stats.title') }}</h1>
    </header>

    <div class="tabs">
      <button
        v-for="p in PERIODS"
        :key="p"
        type="button"
        :class="{ active: days === p }"
        @click="days = p"
      >
        {{ t('stats.days', { n: p }) }}
      </button>
    </div>

    <section class="summary">
      <div class="summary-item">
        <strong>{{ totals.plays.toLocaleString() }}</strong>
        <small>{{ t('stats.plays') }}</small>
      </div>
      <div class="summary-item">
        <strong>{{ duration(totals.seconds) }}</strong>
        <small>{{ t('stats.playtime') }}</small>
      </div>
      <div class="summary-item">
        <strong>{{ totals.players.toLocaleString() }}</strong>
        <small>{{ t('stats.players') }}</small>
      </div>
    </section>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.slug" class="row">
        <span class="thumb"><GameIcon :slug="row.slug" /></span>
        <div class="info">
          <div class="title-line">
            <strong>{{ t(row.titleKey) }}</strong>
            <span class="time">{{ duration(row.stat?.total_seconds ?? 0) }}</span>
          </div>
          <div class="bar">
            <span
              class="fill"
              :style="{ width: `${((row.stat?.total_seconds ?? 0) / maxSeconds) * 100}%` }"
            />
          </div>
          <div class="metrics">
            <span>{{ t('stats.plays') }} {{ (row.stat?.plays ?? 0).toLocaleString() }}</span>
            <span>{{ t('stats.avg') }} {{ duration(row.stat?.avg_seconds ?? 0) }}</span>
            <span>{{ t('stats.players') }} {{ (row.stat?.players ?? 0).toLocaleString() }}</span>
            <span>{{ t('stats.best') }} {{ (row.stat?.best_score ?? 0).toLocaleString() }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.stats {
  padding: 20px 16px;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.stats-header h1 {
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
  background: #fff;
  color: #bcaaa4;
  cursor: pointer;
}

.tabs button.active {
  background: #8d6e63;
  color: #fff;
  font-weight: bold;
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
  background: #fff;
  border-radius: 14px;
}

.summary-item strong {
  font-size: 17px;
  color: #5d4037;
}

.summary-item small {
  font-size: 11px;
  color: #bcaaa4;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: #8d6e63;
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
  background: #fff;
  border-radius: 14px;
}

.thumb {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
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
  font-size: 15px;
}

.time {
  font-size: 13px;
  font-weight: bold;
  color: #43a047;
}

.bar {
  height: 6px;
  margin: 6px 0;
  border-radius: 3px;
  background: rgb(141 110 99 / 0.15);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #43a047;
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 11px;
  color: #bcaaa4;
}
</style>
