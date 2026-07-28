<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import { pauseRunningGame, resumeRunningGame } from '@/games/shell'
import type { GameModule } from '@/games/types'
import GameGuide from '@/shared/GameGuide.vue'
import { createGameContext } from '@/shared/gameContext'
import { t, type TranslationKey } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'
import { bgmFor, duckBgm, resumeBgm, startBgm, stopBgm } from '@/shared/music'
import { startPlayTracking } from '@/shared/playSessions'
import { fetchMyStats, getLocalBest, syncLocalBests } from '@/shared/scores'
import { startScoreGuard } from '@/shared/scoreGuard'

const route = useRoute()
const router = useRouter()
const host = ref<HTMLDivElement | null>(null)
const slug = String(route.params.slug)
const titleKey = ref<TranslationKey | null>(null)
const guideOpen = ref(false)

// 일시정지 — 실시간 게임은 전화 한 통에 판이 날아간다.
// 화면을 벗어나면 자동으로 멈추고, 돌아올 때는 곧바로 재개하지 않고 셋을 센다.
const paused = ref(false)
const countdown = ref(0)
let countdownId = 0

// 플레이 중 최고 기록 표시 — 넘어서는 순간이 "한 판 더"의 방아쇠라 실시간으로 보여준다
const best = ref<number | null>(null)
const live = ref(0)
const isRecord = computed(() => best.value !== null && live.value > best.value)
const bestLabel = computed(() => {
  if (best.value === null) return ''
  return isRecord.value
    ? t('hud.record', { n: live.value.toLocaleString() })
    : t('hud.best', { n: best.value.toLocaleString() })
})

let game: GameModule | null = null
let disposed = false
let stopTracking: (() => void) | null = null
let stopScoreGuard: (() => void) | null = null
let pollId = 0

// 가이드를 읽는 동안 제한 시간이 깎이거나 적이 다가오지 않도록 게임을 멈춘다
function openGuide() {
  guideOpen.value = true
  pauseRunningGame()
}

function closeGuide() {
  guideOpen.value = false
  resumeRunningGame()
}

function stopCountdown() {
  if (!countdownId) return
  clearInterval(countdownId)
  countdownId = 0
  countdown.value = 0
}

function pauseGame() {
  // 카운트다운 도중이면 그 카운트다운을 접고 다시 멈춤 상태로 돌아간다
  if (countdownId) {
    stopCountdown()
    return
  }
  if (paused.value) return
  paused.value = true
  pauseRunningGame()
  duckBgm()
}

// 셋을 세고 재개한다 — 돌아오자마자 죽어 있으면 억울하다
function resumeGame() {
  if (!paused.value || countdownId) return
  paused.value = false
  countdown.value = 3
  countdownId = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value > 0) return
    stopCountdown()
    resumeRunningGame()
  }, 700)
  resumeBgm()
}

// 화면을 벗어나면 (전화·알림·홈으로 나감) 자동으로 멈춘다.
// 셸도 백그라운드에서 루프를 세우지만, 돌아오는 순간 바로 이어져서 손쓸 새가 없었다.
function onVisibility() {
  if (document.hidden) pauseGame()
}

onMounted(async () => {
  const meta = GAMES.find((g) => g.slug === slug)
  if (!meta || !host.value) {
    router.replace('/')
    return
  }
  titleKey.value = meta.titleKey
  // 홈을 거치지 않고 바로 들어왔을 수도 있다. 서버 최고점을 맞춰두지 않으면
  // 상단 칩과 게임오버의 신기록 판정이 이 기기 기록만 보고 잘못 나온다.
  void fetchMyStats()
    .then(syncLocalBests)
    .catch(() => {})
  const mod = await meta.loader()
  // 로드 완료 전에 페이지를 떠났으면 mount하지 않는다
  if (disposed) return
  game = mod.default
  game.mount(host.value, createGameContext(slug))
  stopTracking = startPlayTracking(slug)
  stopScoreGuard = startScoreGuard(slug, () => game?.currentScore() ?? null)
  startBgm(bgmFor(slug))
  document.addEventListener('visibilitychange', onVisibility)
  // 최고 기록은 게임오버 제출 때 갱신되므로 현재 점수와 함께 다시 읽는다
  pollId = window.setInterval(() => {
    best.value = getLocalBest(slug)
    live.value = game?.currentScore() ?? 0
  }, 250)
})

onBeforeUnmount(() => {
  disposed = true
  clearInterval(pollId)
  stopCountdown()
  document.removeEventListener('visibilitychange', onVisibility)
  stopBgm()
  // 게임을 정리하기 전에 마지막 점수를 읽어야 한다
  stopScoreGuard?.()
  stopScoreGuard = null
  game?.unmount()
  game = null
  stopTracking?.()
  stopTracking = null
})
</script>

<template>
  <div class="play-page">
    <div ref="host" class="game-host"></div>
    <div class="top-bar">
      <button class="chip back-button" type="button" @click="router.push('/')">
        <UiIcon name="back" />{{ t('common.back') }}
      </button>
      <div class="best-slot">
        <div v-if="bestLabel" class="chip best-chip" :class="{ record: isRecord }">
          {{ bestLabel }}
        </div>
      </div>
      <button
        class="chip icon-button"
        type="button"
        :aria-label="t('pause.title')"
        @click="pauseGame"
      >
        <span class="pause-glyph"></span>
      </button>
      <button
        class="chip icon-button"
        type="button"
        :aria-label="t('guide.title')"
        @click="openGuide"
      >
        ?
      </button>
    </div>

    <!-- 멈춤 화면 -->
    <div v-if="paused" class="pause-scrim">
      <div class="pause-sheet">
        <p class="pause-title">{{ t('pause.title') }}</p>
        <button class="btn btn--go" type="button" @click="resumeGame">{{ t('pause.resume') }}</button>
        <button class="btn btn--ghost" type="button" @click="router.push('/')">
          {{ t('pause.quit') }}
        </button>
      </div>
    </div>

    <!-- 재개 카운트다운 (숫자뿐이라 언어를 타지 않는다) -->
    <div v-if="countdown > 0" class="countdown">{{ countdown }}</div>

    <GameGuide
      v-if="guideOpen && titleKey"
      :slug="slug"
      :title="t(titleKey)"
      @close="closeGuide"
    />
  </div>
</template>

<style scoped>
.play-page {
  position: relative;
  height: 100dvh;
}

.game-host {
  position: absolute;
  inset: 0;
}

/* 뒤로·최고기록·도움말을 한 줄로 묶는다. 예전에는 셋이 제각각 크기라
   게임 화면 위에 흩어져 보였다. 캔버스를 덮으므로 줄 자체는 탭을 받지 않는다. */
.top-bar {
  position: absolute;
  top: calc(10px + env(safe-area-inset-top));
  left: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.chip {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 14px;
  border: none;
  border-radius: 19px;
  background: rgb(255 255 255 / 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgb(40 24 16 / 0.16);
  color: #5d4037;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  transition:
    transform 0.1s ease,
    background-color 0.1s ease;
}

/* 뒤로 버튼 길이가 언어마다 달라도 기록이 두 버튼 사이 한가운데에 오도록 */
.best-slot {
  display: flex;
  flex: 1;
  justify-content: center;
  min-width: 0;
}

.back-button {
  gap: 4px;
  padding-left: 10px;
  cursor: pointer;
  pointer-events: auto;
}

.back-button svg {
  width: 17px;
  height: 17px;
}

.back-button:active,
.icon-button:active {
  background: rgb(255 255 255 / 0.98);
  transform: scale(0.95);
}

.best-chip {
  overflow: hidden;
  font-size: 13px;
  color: #7d6a63;
  text-overflow: ellipsis;
}

.best-chip.record {
  background: #ffca28;
  color: #5d4037;
  box-shadow: 0 2px 10px rgb(245 166 0 / 0.45);
}

.icon-button {
  justify-content: center;
  width: 38px;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}

/* 멈춤 표시는 글자가 아니라 두 줄로 그린다 (기기마다 글꼴이 달라도 같아 보인다) */
.pause-glyph {
  display: block;
  width: 12px;
  height: 14px;
  border-left: 4px solid #5d4037;
  border-right: 4px solid #5d4037;
}

.pause-scrim {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(26 17 12 / 0.58);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  animation: pause-fade 0.16s ease-out;
}

.pause-sheet {
  width: min(300px, 100%);
  padding: 26px 22px 20px;
  border-radius: 28px;
  background: linear-gradient(#fffdfa, #fff0da);
  box-shadow:
    0 22px 52px rgb(22 11 4 / 0.4),
    inset 0 2px 0 #fff;
  text-align: center;
}

.pause-title {
  margin-bottom: 6px;
  font-size: 19px;
  font-weight: 800;
  color: #7a6053;
}

.pause-sheet .btn {
  margin-top: 12px;
}

.pause-sheet .btn--ghost {
  margin-top: 6px;
}

.countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(26 17 12 / 0.32);
  color: #fff;
  font-size: 96px;
  font-weight: 800;
  text-shadow: 0 4px 18px rgb(0 0 0 / 0.5);
  pointer-events: none;
  animation: countdown-pop 0.7s ease-out;
}

@keyframes pause-fade {
  from {
    opacity: 0;
  }
}

@keyframes countdown-pop {
  from {
    transform: scale(1.5);
    opacity: 0.2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pause-scrim,
  .countdown {
    animation: none;
  }
}
</style>
