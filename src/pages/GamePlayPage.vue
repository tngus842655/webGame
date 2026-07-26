<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import { pauseRunningGame, resumeRunningGame } from '@/games/shell'
import type { GameModule } from '@/games/types'
import GameGuide from '@/shared/GameGuide.vue'
import { createGameContext } from '@/shared/gameContext'
import { t, type TranslationKey } from '@/shared/i18n'
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
    <button class="back-button" type="button" @click="router.push('/')">{{ t('common.back') }}</button>
    <div v-if="bestLabel" class="best-chip" :class="{ record: isRecord }">{{ bestLabel }}</div>
    <button
      class="guide-button"
      type="button"
      :aria-label="t('guide.title')"
      @click="openGuide"
    >
      ?
    </button>

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

.back-button {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  left: 12px;
  padding: 8px 14px;
  border: none;
  border-radius: 20px;
  background: rgb(255 255 255 / 0.85);
  color: #5d4037;
  font-size: 15px;
  cursor: pointer;
}

/* 게임 캔버스 위에 얹히므로 탭을 가로채지 않게 한다 */
.best-chip {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 14px;
  border-radius: 14px;
  background: rgb(255 255 255 / 0.85);
  color: #7d6a63;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  pointer-events: none;
}

.best-chip.record {
  background: #ffca28;
  color: #5d4037;
}

.guide-button {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  right: 12px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.85);
  color: #5d4037;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
}
</style>
