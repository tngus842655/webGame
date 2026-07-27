<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { GAMES } from '@/games/registry'
import { getCurrentUserId } from '@/shared/auth'
import { t } from '@/shared/i18n'
import { fetchLeaderboard, type LeaderboardEntry } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

const route = useRoute()
const slug = String(route.params.slug)
const game = GAMES.find((g) => g.slug === slug)

const period = ref<'week' | 'all'>('week')
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
      <button type="button" :class="{ active: period === 'all' }" @click="period = 'all'">
        {{ t('ranking.all') }}
      </button>
    </div>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="entries.length === 0" class="notice">{{ t('ranking.empty') }}</p>
    <ol v-else class="board">
      <li v-for="(entry, i) in entries" :key="entry.user_id" :class="{ me: entry.user_id === myUserId }">
        <span class="rank">{{ i + 1 }}</span>
        <span class="name">{{ entry.nickname }}</span>
        <span class="score">{{ entry.best_score.toLocaleString() }}</span>
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
  margin-bottom: 16px;
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

.notice {
  padding: 40px 0;
  text-align: center;
  color: #8d6e63;
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
  background: #fff;
  border-radius: 12px;
}

.board li.me {
  outline: 2px solid #43a047;
}

.rank {
  width: 28px;
  font-weight: bold;
  color: #8d6e63;
  text-align: center;
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
