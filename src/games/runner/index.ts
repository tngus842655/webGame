import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { CanvasStage } from '../stage'
import {
  AIR_BAR_TOP,
  GROUND_Y,
  JUMP_V,
  PLAYER_H,
  PLAYER_W,
  PLAYER_X,
  createState,
  scoreOf,
  update,
} from './state'

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const stage = new CanvasStage(wrapper, 720, 1280)
  const state = createState()
  let destroyed = false
  let adContinueUsed = false

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 이어하기',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('runner_continue')
    if (destroyed || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.obstacles = []
    state.playerY = GROUND_Y
    state.vy = 0
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      if (state.phase !== 'playing' || state.jumpsLeft <= 0) return
      state.vy = JUMP_V
      state.jumpsLeft -= 1
      playDrop()
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#FFE0B2', '#E1F5FE')

    // 땅
    c.fillStyle = '#A1887F'
    c.fillRect(0, GROUND_Y, 720, 1280 - GROUND_Y)
    c.fillStyle = '#8BC34A'
    c.fillRect(0, GROUND_Y, 720, 14)

    // 장애물
    for (const o of state.obstacles) {
      if (o.air) {
        c.fillStyle = '#FFA726'
        c.beginPath()
        c.roundRect(o.x, AIR_BAR_TOP, o.w, o.h, 12)
        c.fill()
      } else {
        c.fillStyle = '#66BB6A'
        c.beginPath()
        c.roundRect(o.x, GROUND_Y - o.h, o.w, o.h, 10)
        c.fill()
      }
    }

    // 코인
    c.fillStyle = '#FFC107'
    for (const coin of state.coins) {
      c.beginPath()
      c.arc(coin.x, coin.y, 18, 0, Math.PI * 2)
      c.fill()
    }

    // 플레이어
    const top = state.playerY - PLAYER_H
    c.fillStyle = '#FF7043'
    c.beginPath()
    c.roundRect(PLAYER_X - PLAYER_W / 2, top, PLAYER_W, PLAYER_H, 14)
    c.fill()
    c.fillStyle = '#3E2723'
    c.beginPath()
    c.arc(PLAYER_X + 6, top + 22, 5, 0, Math.PI * 2)
    c.arc(PLAYER_X + 20, top + 22, 5, 0, Math.PI * 2)
    c.fill()

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '22px sans-serif'
    c.fillText('점수', 360, 60)
    c.fillStyle = '#5D4037'
    c.font = 'bold 52px sans-serif'
    c.fillText(scoreOf(state).toLocaleString(), 360, 118)

    if (state.time < 3 && state.phase === 'playing') {
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText('탭 = 점프 (한 번 더 탭하면 2단 점프)', 360, 500)
      c.fillText('주황 막대는 점프하지 말고 지나가세요!', 360, 540)
    }
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.coinsTaken > 0) playMerge(2)
      if (result.died) void gameOver()
    }
    draw()
  }

  const onVisibility = () => {
    if (destroyed) return
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else {
      last = performance.now()
      rafId = requestAnimationFrame(frame)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(frame)

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      detachInput()
      stage.destroy()
      wrapper.remove()
    },
  }
}

let session: Session | null = null

const runnerGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default runnerGame
