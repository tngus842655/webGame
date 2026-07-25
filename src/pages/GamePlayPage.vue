<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import type { GameModule } from '@/games/types'
import { createGameContext } from '@/shared/gameContext'
import { t } from '@/shared/i18n'
import { recordPlaySession } from '@/shared/playSessions'

const route = useRoute()
const router = useRouter()
const host = ref<HTMLDivElement | null>(null)

let game: GameModule | null = null
let disposed = false
let startedAt = 0
let playedSlug = ''

onMounted(async () => {
  const slug = String(route.params.slug)
  const meta = GAMES.find((g) => g.slug === slug)
  if (!meta || !host.value) {
    router.replace('/')
    return
  }
  const mod = await meta.loader()
  // 로드 완료 전에 페이지를 떠났으면 mount하지 않는다
  if (disposed) return
  game = mod.default
  game.mount(host.value, createGameContext(slug))
  playedSlug = slug
  startedAt = performance.now()
})

onBeforeUnmount(() => {
  disposed = true
  game?.unmount()
  game = null
  // 통계용 체류 시간 기록 (게임 코드와 무관하게 화면 진입~이탈로 측정)
  if (playedSlug && startedAt > 0) {
    void recordPlaySession(playedSlug, (performance.now() - startedAt) / 1000)
  }
})
</script>

<template>
  <div class="play-page">
    <div ref="host" class="game-host"></div>
    <button class="back-button" type="button" @click="router.push('/')">{{ t('common.back') }}</button>
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
</style>
