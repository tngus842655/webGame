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
import { bgmFor, startBgm, stopBgm } from '@/shared/music'
import { startPlayTracking } from '@/shared/playSessions'
import { getLocalBest } from '@/shared/scores'
import { startScoreGuard } from '@/shared/scoreGuard'

const route = useRoute()
const router = useRouter()
const host = ref<HTMLDivElement | null>(null)
const slug = String(route.params.slug)
const titleKey = ref<TranslationKey | null>(null)
const guideOpen = ref(false)

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

onMounted(async () => {
  const meta = GAMES.find((g) => g.slug === slug)
  if (!meta || !host.value) {
    router.replace('/')
    return
  }
  titleKey.value = meta.titleKey
  const mod = await meta.loader()
  // 로드 완료 전에 페이지를 떠났으면 mount하지 않는다
  if (disposed) return
  game = mod.default
  game.mount(host.value, createGameContext(slug))
  stopTracking = startPlayTracking(slug)
  stopScoreGuard = startScoreGuard(slug, () => game?.currentScore() ?? null)
  startBgm(bgmFor(slug))
  // 최고 기록은 게임오버 제출 때 갱신되므로 현재 점수와 함께 다시 읽는다
  pollId = window.setInterval(() => {
    best.value = getLocalBest(slug)
    live.value = game?.currentScore() ?? 0
  }, 250)
})

onBeforeUnmount(() => {
  disposed = true
  clearInterval(pollId)
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
        class="chip guide-button"
        type="button"
        :aria-label="t('guide.title')"
        @click="openGuide"
      >
        ?
      </button>
    </div>

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
.guide-button:active {
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

.guide-button {
  justify-content: center;
  width: 38px;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
}
</style>
