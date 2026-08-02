<script setup lang="ts">
// 운영자 전용 — 통계 요약의 '이용자 수'를 사람 단위로 펼쳐 본다.
// 여기서 답하려는 질문은 하나다: 누가 어떤 게임을 얼마나 했나.
import { onMounted, ref, watch } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { locale, t } from '@/shared/i18n'
import {
  fetchPlayerStats,
  fetchTotalPlayers,
  formatDuration,
  PLAYER_LIMIT,
  STATS_PERIODS,
  statsDays,
  type PlayerStat,
} from '@/shared/playSessions'
import UiIcon from '@/shared/UiIcon.vue'

const players = ref<PlayerStat[]>([])
const total = ref(0)
const loading = ref(true)
const failed = ref(false)

// 한 사람씩 펼쳐 본다. 들어오자마자 맨 위 한 명은 펼쳐 두어,
// 눌러야 내역이 나온다는 것이 화면만 보고도 보이게 한다.
const open = ref('')

async function load() {
  loading.value = true
  failed.value = false
  try {
    // 잘렸는지 알려면 이 기간의 전체 인원이 필요하다 — 통계 요약이 쓰는 값과 같다
    const [rows, count] = await Promise.all([
      fetchPlayerStats(statsDays.value),
      fetchTotalPlayers(statsDays.value),
    ])
    players.value = rows
    total.value = count
    open.value = rows[0]?.userId ?? ''
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(statsDays, load)

const TITLES = new Map(GAMES.map((game) => [game.slug, game.titleKey]))

// 레지스트리에서 빠진 게임도 기록은 남는다 — 이름을 못 찾으면 slug를 그대로 쓴다
function gameName(slug: string): string {
  const key = TITLES.get(slug)
  return key ? t(key) : slug
}

// 아직 노는 사람인지 판단하는 값이라 날짜와 시각을 함께 본다
function when(iso: string): string {
  return new Date(iso).toLocaleString(locale.value, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="players">
    <header class="page-header">
      <RouterLink class="back" to="/stats"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('stats.playersTitle') }}</h1>
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

    <p class="hint">{{ t('stats.playersHint') }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="players.length === 0" class="notice">{{ t('stats.playersEmpty') }}</p>
    <template v-else>
      <p v-if="total > players.length" class="capped">
        {{ t('stats.playersCapped', { total, n: PLAYER_LIMIT }) }}
      </p>

      <ol class="list">
        <li v-for="(player, i) in players" :key="player.userId" class="card">
          <button
            type="button"
            class="head"
            :aria-expanded="open === player.userId"
            @click="open = open === player.userId ? '' : player.userId"
          >
            <span class="rank">{{ i + 1 }}</span>
            <span class="who">
              <strong>{{ player.nickname }}</strong>
              <small>
                {{ t('stats.plays') }} {{ player.plays.toLocaleString() }} ·
                {{ t('stats.gamesPlayed') }} {{ player.games.length }} ·
                {{ t('stats.lastPlayed') }} {{ when(player.lastPlayedAt) }}
              </small>
            </span>
            <span class="time">{{ formatDuration(player.seconds) }}</span>
            <span class="chevron" :class="{ open: open === player.userId }">
              <UiIcon name="chevron" />
            </span>
          </button>

          <ul v-if="open === player.userId" class="games">
            <li v-for="game in player.games" :key="game.slug">
              <span class="thumb"><GameIcon :slug="game.slug" /></span>
              <div class="info">
                <div class="title-line">
                  <span class="name">{{ gameName(game.slug) }}</span>
                  <span class="game-time">{{ formatDuration(game.seconds) }}</span>
                </div>
                <!-- 그 사람이 가장 오래 한 게임을 가득 찬 길이로 두고 나머지를 견준다 -->
                <div class="bar">
                  <span
                    class="fill"
                    :style="{ width: `${(game.seconds / player.games[0].seconds) * 100}%` }"
                  />
                </div>
                <small class="metrics">
                  {{ t('stats.plays') }} {{ game.plays.toLocaleString() }}
                </small>
              </div>
            </li>
          </ul>
        </li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.players {
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

.hint {
  margin-bottom: 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-faint);
  word-break: keep-all;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.capped {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--ink-muted);
  word-break: keep-all;
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
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 14px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rank {
  flex: none;
  width: 18px;
  font-size: 13px;
  font-weight: bold;
  color: var(--ink-faint);
  text-align: center;
}

.who {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.who strong {
  overflow: hidden;
  font-size: 14.5px;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who small {
  font-size: 11px;
  line-height: 1.4;
  color: var(--ink-faint);
  word-break: keep-all;
}

.time {
  flex: none;
  font-size: 13px;
  font-weight: bold;
  color: #43a047;
}

/* 닫혀 있을 때는 오른쪽을 가리키다가 펼치면 아래를 가리킨다 */
.chevron {
  flex: none;
  width: 13px;
  height: 13px;
  color: var(--ink-faint);
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.games {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 14px;
  padding: 11px 0 13px;
  border-top: 1px solid var(--line-soft);
}

.games li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.thumb {
  flex: none;
  width: 26px;
  height: 26px;
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

.name {
  overflow: hidden;
  font-size: 13px;
  color: var(--ink-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-time {
  flex: none;
  font-size: 12px;
  font-weight: bold;
  color: var(--ink-body);
}

.bar {
  height: 5px;
  margin: 5px 0 4px;
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
  font-size: 11px;
  color: var(--ink-faint);
}
</style>
