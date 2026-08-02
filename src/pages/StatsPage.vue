<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import {
  fetchGameStats,
  fetchTotalPlayers,
  formatDuration,
  STATS_PERIODS,
  statsDays,
  type GameStat,
} from '@/shared/playSessions'
import UiIcon from '@/shared/UiIcon.vue'

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

const totalSeconds = computed(() => stats.value.reduce((sum, s) => sum + s.total_seconds, 0))

const maxSeconds = computed(() => Math.max(1, ...stats.value.map((s) => s.total_seconds)))

async function load() {
  loading.value = true
  failed.value = false
  try {
    const [rows, total] = await Promise.all([
      fetchGameStats(statsDays.value),
      fetchTotalPlayers(statsDays.value),
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
watch(statsDays, load)
</script>

<template>
  <div class="stats">
    <header class="stats-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('stats.title') }}</h1>
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

    <p class="hint">{{ t('stats.hint') }}</p>

    <section class="summary">
      <div class="summary-item">
        <strong>{{ formatDuration(totalSeconds) }}</strong>
        <small>{{ t('stats.playtime') }}</small>
      </div>
      <!-- 몇 명인지까지가 이 칸의 몫이고, 누가 무엇을 했는지는 상세에서 본다.
           칸 전체가 과녁이고 아래 알약은 눌러도 된다는 표시다 — 11px 글자만으로는
           손가락에 비해 과녁이 너무 작다. -->
      <RouterLink class="summary-item detail" to="/stats/players">
        <strong>{{ players.toLocaleString() }}</strong>
        <small>{{ t('stats.players') }}</small>
        <span class="detail-chip">
          {{ t('stats.playerDetail') }}<UiIcon name="chevron" />
        </span>
      </RouterLink>
    </section>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.slug" class="row">
        <span class="thumb"><GameIcon :slug="row.slug" /></span>
        <div class="info">
          <div class="title-line">
            <strong>{{ t(row.titleKey) }}</strong>
            <span class="time">{{ formatDuration(row.stat?.total_seconds ?? 0) }}</span>
          </div>
          <div class="bar">
            <span
              class="fill"
              :style="{ width: `${((row.stat?.total_seconds ?? 0) / maxSeconds) * 100}%` }"
            />
          </div>
          <div class="metrics">
            <span>{{ t('stats.avg') }} {{ formatDuration(row.stat?.avg_seconds ?? 0) }}</span>
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
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

/* 상세보기가 붙은 칸이 더 높아 옆 칸이 따라 늘어난다 — 가운데로 모아 준다 */
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

.detail {
  transition: background-color 0.12s ease;
}

.detail:active {
  background: var(--surface-press);
}

/* 숫자를 가리지 않도록 칸 아래에 작게 앉힌다 */
.detail-chip {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  padding: 3px 7px 3px 9px;
  border-radius: 999px;
  background: var(--surface-tint);
  font-size: 11px;
  font-weight: bold;
  color: var(--ink-muted);
}

.detail-chip svg {
  width: 10px;
  height: 10px;
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
