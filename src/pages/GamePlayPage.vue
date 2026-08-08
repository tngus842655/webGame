<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import { ensureAdminChecked, isAdmin } from '@/shared/admin'
import { pauseRunningGame, resumeRunningGame } from '@/games/shell'
import type { GameModule } from '@/games/types'
import GameGuide from '@/shared/GameGuide.vue'
import GameVote from '@/shared/GameVote.vue'
import { setBackHandler } from '@/shared/backButton'
import { createGameContext } from '@/shared/gameContext'
import { t, type TranslationKey } from '@/shared/i18n'
import { markPlayed } from '@/shared/library'
import UiIcon from '@/shared/UiIcon.vue'
import { bgmFor, duckBgm, resumeBgm, startBgm, stopBgm } from '@/shared/music'
import { startPlayTracking } from '@/shared/playSessions'
import { fetchMyStats, getLocalBest, syncLocalBests } from '@/shared/scores'
import { startScoreGuard } from '@/shared/scoreGuard'
import { setHudBest } from '@/games/ui'

const route = useRoute()
const router = useRouter()
const host = ref<HTMLDivElement | null>(null)
const slug = String(route.params.slug)
const titleKey = ref<TranslationKey | null>(null)
const guideOpen = ref(false)
// 이 게임이 '다음 단계'를 지원하는지 (버튼은 관리자에게만 보인다)
const canAdminSkip = ref(false)
// 진도를 기기에 저장하는 게임만 '진도 초기화'를 지원한다
const canAdminReset = ref(false)
// 되돌릴 수 없는 일이라 두 번 눌러야 실행된다 (첫 탭은 칩 문구만 바꾼다)
const resetArmed = ref(false)
let resetArmId = 0

function skipLevel() {
  game?.adminSkip()
}

function resetProgress() {
  if (!resetArmed.value) {
    resetArmed.value = true
    resetArmId = window.setTimeout(() => {
      resetArmed.value = false
    }, 3000)
    return
  }
  clearTimeout(resetArmId)
  resetArmed.value = false
  game?.adminReset()
}

// 일시정지 — 실시간 게임은 전화 한 통에 판이 날아간다.
// 화면을 벗어나면 자동으로 멈추고, 돌아올 때는 곧바로 재개하지 않고 셋을 센다.
const paused = ref(false)
const countdown = ref(0)
let countdownId = 0

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
  if (paused.value) return
  // 카운트다운 도중이면 그 카운트다운을 접고 다시 멈춤 상태로 돌아간다.
  // 셸은 셋을 다 세야 풀리므로 아직 멈춘 채다 — 여기서 또 멈추면 depth가 어긋나 영영 안 풀린다.
  if (countdownId) stopCountdown()
  else pauseRunningGame()
  paused.value = true
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

// 안드로이드 하드웨어 뒤로가기. 게임을 하다 화면 아래를 스치면 판이 통째로 날아가던 자리라,
// 첫 번째 누름은 일시정지가 받아낸다 — 누르는 순간 멈추므로 망설이는 사이에 죽지 않는다.
// 멈춘 상태에서 한 번 더 누르면 그때는 나간다 (뒤로가기로 결국 나갈 수 있어야 한다).
function onHardwareBack() {
  if (guideOpen.value) closeGuide()
  else if (paused.value) void router.push('/')
  else pauseGame()
}

onMounted(async () => {
  const meta = GAMES.find((g) => g.slug === slug)
  if (!meta || !host.value) {
    router.replace('/')
    return
  }
  titleKey.value = meta.titleKey
  // 홈의 '최근 플레이' 줄. 게임을 실제로 붙이기 전에 남긴다 — 로딩 도중 나가도
  // 열어본 것은 사실이고, 다시 찾아 들어가려는 사람에게는 그게 필요한 정보다.
  markPlayed(slug)
  // 홈을 거치지 않고 바로 들어왔을 수도 있다. 서버 최고점을 맞춰두지 않으면
  // 점수판과 게임오버의 신기록 판정이 이 기기 기록만 보고 잘못 나온다.
  void fetchMyStats()
    .then(syncLocalBests)
    .catch(() => {})
  const mod = await meta.loader()
  // 로드 완료 전에 페이지를 떠났으면 mount하지 않는다
  if (disposed) return
  game = mod.default
  game.mount(host.value, createGameContext(slug))
  // 관리자 전용 '다음 단계'. 판이 나뉘는 게임에서만 뜨고, 홈을 거치지 않고 바로
  // 들어온 경우를 위해 여기서 한 번 확인한다 (결과는 캐시된다).
  canAdminSkip.value = game.canAdminSkip()
  canAdminReset.value = game.canAdminReset()
  void ensureAdminChecked()
  stopTracking = startPlayTracking(slug)
  stopScoreGuard = startScoreGuard(slug, () => game?.currentScore() ?? null)
  startBgm(bgmFor(slug))
  document.addEventListener('visibilitychange', onVisibility)
  // 게임이 실제로 붙은 뒤부터 뒤로가기를 받는다 — 로딩 중에는 지킬 판이 아직 없다
  setBackHandler(onHardwareBack)
  // 플레이 중 최고 기록은 게임의 점수판이 머리줄에 함께 그린다 — 화면 위에 따로 띄우면
  // 세로가 짧은 기기에서 그 점수판과 겹쳤다. 기록은 게임오버 제출 때 갱신되므로
  // 현재 점수와 함께 다시 읽는다 (넘어섰는지는 점수판이 이 둘을 비교해 판정한다).
  pollId = window.setInterval(() => {
    setHudBest(getLocalBest(slug), game?.currentScore() ?? 0)
  }, 250)
})

onBeforeUnmount(() => {
  disposed = true
  setBackHandler(null)
  clearInterval(pollId)
  clearTimeout(resetArmId)
  // 다음 게임이 이전 게임의 기록을 달고 뜨지 않도록 (첫 갱신까지 250ms가 뜬다)
  setHudBest(null, 0)
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
      <div class="top-left">
        <button class="chip back-button" type="button" @click="router.push('/')">
          <UiIcon name="back" />{{ t('common.back') }}
        </button>
        <button
          v-if="isAdmin && canAdminSkip"
          class="chip skip-button"
          type="button"
          @click="skipLevel"
        >
          {{ t('admin.skipLevel') }}
        </button>
        <button
          v-if="isAdmin && canAdminReset"
          class="chip skip-button"
          type="button"
          @click="resetProgress"
        >
          {{ resetArmed ? t('admin.resetConfirm') : t('admin.resetProgress') }}
        </button>
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

    <GameVote class="vote-row" :slug="slug" />

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
  /* .app-shell이 이미 위아래로 safe-area 만큼 패딩을 넣는다. 여기서 100dvh를
     그대로 쓰면 그 패딩만큼 넘쳐서 페이지가 세로로 스크롤된다 — 게임 중 더블탭하면
     화면이 딱 그만큼 밀리던 원인이다. 브라우저는 inset이 0이라 드러나지 않고
     웹뷰와 '홈 화면에 추가'에서만 나타났다. */
  height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}

.game-host {
  position: absolute;
  inset: 0;
}

/* 뒤로·멈춤·도움말을 한 줄로 묶는다. 예전에는 셋이 제각각 크기라
   게임 화면 위에 흩어져 보였다. 캔버스를 덮으므로 줄 자체는 탭을 받지 않는다.
   safe-area는 .app-shell이 이미 패딩으로 밀어 놨다 — 여기서 또 더하면 노치가 있는
   기기에서만 줄이 그만큼 내려앉아 캔버스 점수판 위를 덮었다. */
.top-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

/* 좋아요·싫어요는 멈춤·도움말 바로 아래에 붙는다 (줄 높이 38 + 사이 8).
   .top-bar 안에 넣으면 그 줄이 두 줄이 되면서 왼쪽 뒤로가기까지 같이 내려앉는다. */
.vote-row {
  position: absolute;
  top: 56px;
  right: 10px;
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
  color: var(--ink-body);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  transition:
    transform 0.1s ease,
    background-color 0.1s ease;
}

/* 왼쪽 묶음은 왼쪽 끝, 멈춤·도움말은 오른쪽 끝으로 (버튼 길이가 언어마다 달라도) */
.top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

/* 관리자 전용이라 평소에는 없는 버튼이다. 게임 조작이 아니라는 게 보이도록
   같은 칩 모양을 쓰되 글씨를 옅게 둔다. */
.skip-button {
  pointer-events: auto;
  color: var(--ink-muted);
  font-weight: 600;
}

.skip-button:active {
  background: rgb(255 255 255 / 0.98);
  transform: scale(0.95);
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
  color: var(--ink-muted);
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

[data-theme='dark'] .chip {
  background: rgb(38 31 27 / 0.86);
}

[data-theme='dark'] .back-button:active,
[data-theme='dark'] .icon-button:active {
  background: rgb(38 31 27 / 0.98);
}

[data-theme='dark'] .pause-glyph {
  border-color: var(--ink-body);
}

[data-theme='dark'] .pause-sheet {
  background: linear-gradient(#332a26, #2a221e);
  box-shadow:
    0 22px 52px rgb(0 0 0 / 0.6),
    inset 0 2px 0 rgb(255 255 255 / 0.06);
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
