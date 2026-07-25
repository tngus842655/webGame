<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import AccountPrompt from '@/shared/AccountPrompt.vue'
import { linkedProvider } from '@/shared/auth'
import GameIcon from '@/shared/GameIcon.vue'
import { t } from '@/shared/i18n'
import {
  fetchMyStats,
  fetchPopularity,
  getLocalBest,
  type MyGameStat,
} from '@/shared/scores'

const ASKED_KEY = 'webgame:accountAsked'
const router = useRouter()
const askAccount = ref(false)

function answerAccount(existing: boolean) {
  localStorage.setItem(ASKED_KEY, 'done')
  askAccount.value = false
  if (existing) void router.push('/settings')
}

// 첫 화면은 로컬 데이터로 즉시 그리고, 서버 응답이 오면 순위·인기순으로 갱신한다
const cards = ref(
  GAMES.map((game) => ({ ...game, best: getLocalBest(game.slug), stat: null as MyGameStat | null })),
)

onMounted(async () => {
  const [popularity, myStats] = await Promise.all([
    fetchPopularity().catch(() => new Map<string, number>()),
    fetchMyStats().catch(() => [] as MyGameStat[]),
  ])
  const statBySlug = new Map(myStats.map((stat) => [stat.game_slug, stat]))
  const next = cards.value.map((card) => ({ ...card, stat: statBySlug.get(card.slug) ?? null }))
  // 최근 7일 플레이 수 기준 인기순 (동률은 레지스트리 순서 유지)
  next.sort((a, b) => (popularity.get(b.slug) ?? 0) - (popularity.get(a.slug) ?? 0))
  cards.value = next

  // 기존 회원 안내는 '기록이 하나도 없는' 첫 실행에서만 의미가 있다.
  // 세션 조회가 끝난 이 시점이라야 연동 여부(linkedProvider)도 확정된다
  if (localStorage.getItem(ASKED_KEY)) return
  const hasRecord = myStats.length > 0 || cards.value.some((card) => card.best !== null)
  if (hasRecord || linkedProvider.value) localStorage.setItem(ASKED_KEY, 'done')
  else askAccount.value = true
})
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>{{ t('app.title') }}</h1>
      <nav class="header-links">
        <RouterLink to="/ranking" :aria-label="t('home.ranking')">🏆</RouterLink>
        <RouterLink to="/stats" :aria-label="t('stats.title')">📊</RouterLink>
        <RouterLink to="/settings" :aria-label="t('settings.title')">⚙️</RouterLink>
      </nav>
    </header>

    <main class="game-grid">
      <RouterLink
        v-for="game in cards"
        :key="game.slug"
        class="game-card"
        :to="`/play/${game.slug}`"
      >
        <span class="thumb"><GameIcon :slug="game.slug" /></span>
        <strong>{{ t(game.titleKey) }}</strong>
        <small v-if="game.stat">
          {{ t('home.myRank', { score: game.stat.best_score.toLocaleString(), rank: game.stat.rank }) }}
        </small>
        <small v-else-if="game.best !== null">{{ t('home.best', { n: game.best.toLocaleString() }) }}</small>
      </RouterLink>
    </main>

    <AccountPrompt v-if="askAccount" @answer="answerAccount" />
  </div>
</template>

<style scoped>
.home {
  padding: 20px 16px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.home-header h1 {
  font-size: 24px;
}

.header-links {
  display: flex;
  gap: 14px;
  font-size: 22px;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 6px 10px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
  text-align: center;
}

.thumb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  font-size: 30px;
  background: #fff8e1;
  border-radius: 12px;
  margin-bottom: 2px;
}

.game-card strong {
  font-size: 13px;
  line-height: 1.25;
  word-break: keep-all;
}

.game-card small {
  font-size: 11px;
  color: #bcaaa4;
}
</style>
