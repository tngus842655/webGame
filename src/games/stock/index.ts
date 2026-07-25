import { playDrop, playGameOver, playMerge } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { CanvasStage } from '../stage'
import {
  ROUND_SECONDS,
  START_CASH,
  assetOf,
  buy,
  createState,
  scoreOf,
  sell,
  update,
} from './state'

const CHART = { x: 50, y: 220, w: 620, h: 480 }
const BUTTONS = [
  { x: 50, y: 1060, w: 300, h: 90, label: '매수 50%', action: 'buy' as const, portion: 0.5 },
  { x: 370, y: 1060, w: 300, h: 90, label: '풀매수', action: 'buy' as const, portion: 1 },
  { x: 50, y: 1165, w: 300, h: 90, label: '매도 50%', action: 'sell' as const, portion: 0.5 },
  { x: 370, y: 1165, w: 300, h: 90, label: '전량 매도', action: 'sell' as const, portion: 1 },
]

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
  let adExtendUsed = false

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 30초 연장',
    onRetry() {
      if (state.phase !== 'over') return
      adExtendUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void extendWithAd()
    },
  })

  async function extendWithAd() {
    if (state.phase !== 'over' || adExtendUsed) return
    const rewarded = await ctx.showRewardAd('stock_extend')
    if (destroyed || !rewarded || state.phase !== 'over') return
    adExtendUsed = true
    state.timeLeft = 30
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adExtendUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      for (const button of BUTTONS) {
        if (
          p.x >= button.x &&
          p.x <= button.x + button.w &&
          p.y >= button.y &&
          p.y <= button.y + button.h
        ) {
          const ok = button.action === 'buy' ? buy(state, button.portion) : sell(state, button.portion)
          if (ok) {
            if (button.action === 'buy') playDrop()
            else playMerge(3)
          }
          return
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  const won = (n: number) => `${n.toLocaleString()}원`

  const draw = () => {
    const c = stage.begin('#FFE0B2', '#FFF8E1')

    // 타이머 바
    c.fillStyle = 'rgb(141 110 99 / 0.25)'
    c.fillRect(50, 150, 620, 14)
    c.fillStyle = state.timeLeft < 15 ? '#E53935' : '#8D6E63'
    c.fillRect(50, 150, 620 * (state.timeLeft / ROUND_SECONDS), 14)

    // 자산 HUD
    const asset = assetOf(state)
    const profit = asset - START_CASH
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText('총자산', 360, 52)
    c.fillStyle = '#5D4037'
    c.font = 'bold 44px sans-serif'
    c.fillText(won(asset), 360, 102)
    c.fillStyle = profit >= 0 ? '#E53935' : '#1E88E5'
    c.font = 'bold 24px sans-serif'
    const pct = ((profit / START_CASH) * 100).toFixed(2)
    c.fillText(`${profit >= 0 ? '+' : ''}${won(profit)} (${pct}%)`, 360, 136)

    // 차트
    c.fillStyle = 'rgb(255 255 255 / 0.75)'
    c.beginPath()
    c.roundRect(CHART.x, CHART.y, CHART.w, CHART.h, 16)
    c.fill()
    const history = state.history
    const min = Math.min(...history)
    const max = Math.max(...history)
    const span = Math.max(1, max - min)
    c.strokeStyle = state.drift > 0 ? '#E53935' : state.drift < 0 ? '#1E88E5' : '#8D6E63'
    c.lineWidth = 4
    c.lineJoin = 'round'
    c.beginPath()
    for (let i = 0; i < history.length; i++) {
      const x = CHART.x + 14 + ((CHART.w - 28) * i) / Math.max(1, history.length - 1)
      const y = CHART.y + CHART.h - 20 - ((CHART.h - 40) * (history[i] - min)) / span
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()

    // 현재가
    c.textAlign = 'center'
    c.fillStyle = '#5D4037'
    c.font = 'bold 40px sans-serif'
    c.fillText(won(state.price), 360, CHART.y + CHART.h + 58)
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText('현재가 (가상 코인)', 360, CHART.y + CHART.h + 90)

    // 뉴스 배너
    if (state.eventText) {
      c.fillStyle = state.drift > 0 ? 'rgb(229 57 53 / 0.12)' : 'rgb(30 136 229 / 0.12)'
      c.beginPath()
      c.roundRect(50, 840, 620, 60, 14)
      c.fill()
      c.fillStyle = state.drift > 0 ? '#C62828' : '#1565C0'
      c.font = 'bold 26px sans-serif'
      c.fillText(state.eventText, 360, 880)
    }

    // 보유 현황
    c.fillStyle = '#8D6E63'
    c.font = '24px sans-serif'
    c.fillText(`현금 ${won(Math.round(state.cash))} · 보유 ${state.qty.toLocaleString()}개`, 360, 990)

    // 버튼
    for (const button of BUTTONS) {
      const isBuy = button.action === 'buy'
      c.fillStyle = isBuy ? '#E53935' : '#1E88E5'
      c.beginPath()
      c.roundRect(button.x, button.y, button.w, button.h, 16)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 30px sans-serif'
      c.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 11)
    }

    if (state.timeLeft > ROUND_SECONDS - 4 && state.phase === 'playing') {
      c.fillStyle = '#8D6E63'
      c.font = '24px sans-serif'
      c.fillText('90초 동안 사고팔아 수익을 내세요! 뉴스에 주목!', 360, 940)
    }
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (state.phase === 'playing' && update(state, dt)) void gameOver()
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

const stockGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default stockGame
