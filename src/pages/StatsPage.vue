<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import { fetchGameStats, fetchTotalPlayers, type GameStat } from '@/shared/playSessions'
import UiIcon from '@/shared/UiIcon.vue'

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

// 이용자 수는 게임별 값으로 만들 수 없다 (같은 사람이 여러 게임을 하면 겹친다) — 따로 받는다
const players = ref(0)

const totals = computed(() => {
  return stats.value.reduce(
    (acc, s) => ({
      plays: acc.plays + s.plays,
      seconds: acc.seconds + s.total_seconds,
    }),
    { plays: 0, seconds: 0 },
  )
})

const maxSeconds = computed(() => Math.max(1, ...stats.value.map((s) => s.total_seconds)))

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [rows, total] = await Promise.all([
      fetchGameStats(days.value),
      fetchTotalPlayers(days.value),
    ])
    stats.value = rows
    players.value = total
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
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
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

    <p class="hint">{{ t('stats.hint') }}</p>

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
        <strong>{{ players.toLocaleString() }}</strong>
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
  background: var(--surface);
  color: var(--ink-faint);
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
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

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
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
  background: var(--line);
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
  color: var(--ink-faint);
}
</style>
