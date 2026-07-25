<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { GAMES } from '@/games/registry'
import { getCurrentUserId } from '@/shared/auth'
import { fetchLeaderboard, type LeaderboardEntry } from '@/shared/scores'

const route = useRoute()
const slug = String(route.params.slug)
const game = GAMES.find((g) => g.slug === slug)

const period = ref<'week' | 'all'>('week')
const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const errorMsg = ref('')
const myUserId = ref<string | null>(null)

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    entries.value = await fetchLeaderboard(slug, period.value)
  } catch {
    errorMsg.value = '랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
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
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ game?.title ?? '알 수 없는 게임' }} 랭킹</h1>
    </header>

    <div class="tabs">
      <button type="button" :class="{ active: period === 'week' }" @click="period = 'week'">
        주간
      </button>
      <button type="button" :class="{ active: period === 'all' }" @click="period = 'all'">
        전체
      </button>
    </div>

    <p v-if="loading" class="notice">불러오는 중…</p>
    <p v-else-if="errorMsg" class="notice">{{ errorMsg }}</p>
    <p v-else-if="entries.length === 0" class="notice">
      아직 기록이 없습니다. 첫 기록의 주인공이 되어보세요!
    </p>
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

.back {
  font-size: 22px;
  padding: 4px 8px;
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
