import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
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

const CHART = { x: 50, y: 236, w: 620, h: 468 }

interface TradeButton {
  x: number
  y: number
  w: number
  h: number
  label: TranslationKey
  action: 'buy' | 'sell'
  portion: number
}

const BUTTONS: TradeButton[] = [
  { x: 50, y: 1060, w: 300, h: 90, label: 'stock.buy50', action: 'buy', portion: 0.5 },
  { x: 370, y: 1060, w: 300, h: 90, label: 'stock.buyAll', action: 'buy', portion: 1 },
  { x: 50, y: 1165, w: 300, h: 90, label: 'stock.sell50', action: 'sell', portion: 0.5 },
  { x: 370, y: 1165, w: 300, h: 90, label: 'stock.sellAll', action: 'sell', portion: 1 },
]

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing' && update(state, dt)) void gameOver()
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adExtendUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'stock.ad',
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
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adExtendUsed = true
    state.timeLeft = 30
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
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
            vibrate(10) // 체결 손맛
          }
          return
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  const money = (n: number) => t('stock.money', { n: n.toLocaleString() })

  const draw = () => {
    const c = stage.begin('#C7D3DE', '#F4F7FA')
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#FFFFFF')
    sky.addColorStop(0.5, '#F4F7FA')
    sky.addColorStop(1, '#E3EAF2')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)

    const asset = assetOf(state)
    const profit = asset - START_CASH
    const up = profit >= 0
    const accent = up ? '#E5393C' : '#1E88E5'

    // 상단: 자산 패널
    c.save()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.roundRect(40, 24, 640, 128, 26)
    c.fill()
    c.strokeStyle = 'rgb(38 50 56 / 0.1)'
    c.lineWidth = 2
    c.stroke()
    c.restore()

    c.textAlign = 'center'
    c.fillStyle = '#90A4AE'
    c.font = '20px sans-serif'
    c.fillText(t('stock.asset'), 360, 60)
    c.fillStyle = '#263238'
    c.font = 'bold 44px sans-serif'
    c.fillText(money(asset), 360, 106)
    c.fillStyle = accent
    c.font = 'bold 22px sans-serif'
    const pct = ((profit / START_CASH) * 100).toFixed(2)
    c.fillText(`${up ? '+' : ''}${money(profit)} (${pct}%)`, 360, 136)

    // 남은 시간 바
    const ratio = state.timeLeft / ROUND_SECONDS
    c.save()
    c.fillStyle = 'rgb(38 50 56 / 0.12)'
    c.beginPath()
    c.roundRect(40, 168, 640, 12, 6)
    c.fill()
    c.fillStyle = state.timeLeft < 15 ? '#E5393C' : '#546E7A'
    c.beginPath()
    c.roundRect(40, 168, 640 * ratio, 12, 6)
    c.fill()
    c.restore()

    // 남은 시간(초) — 10초 미만이면 붉게 커진다
    const remain = Math.ceil(state.timeLeft)
    const urgent = remain <= 10
    c.textAlign = 'center'
    c.fillStyle = urgent ? '#E5393C' : '#78909C'
    c.font = `bold ${urgent ? 34 : 26}px sans-serif`
    c.fillText(t('sv.time', { n: remain }), 360, 214)

    // 차트 패널
    c.save()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.roundRect(CHART.x, CHART.y, CHART.w, CHART.h, 22)
    c.fill()
    c.strokeStyle = 'rgb(38 50 56 / 0.1)'
    c.lineWidth = 2
    c.stroke()
    c.restore()

    const history = state.history
    const min = Math.min(...history)
    const max = Math.max(...history)
    const span = Math.max(1, max - min)
    const px = (i: number) => CHART.x + 20 + ((CHART.w - 40) * i) / Math.max(1, history.length - 1)
    const py = (v: number) => CHART.y + CHART.h - 26 - ((CHART.h - 52) * (v - min)) / span

    // 격자
    c.save()
    c.strokeStyle = 'rgb(38 50 56 / 0.07)'
    c.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const gy = CHART.y + (CHART.h / 4) * i
      c.beginPath()
      c.moveTo(CHART.x + 14, gy)
      c.lineTo(CHART.x + CHART.w - 14, gy)
      c.stroke()
    }
    c.restore()

    // 시세 영역 채우기
    c.save()
    c.beginPath()
    c.moveTo(px(0), CHART.y + CHART.h - 14)
    for (let i = 0; i < history.length; i++) c.lineTo(px(i), py(history[i]))
    c.lineTo(px(history.length - 1), CHART.y + CHART.h - 14)
    c.closePath()
    const fill = c.createLinearGradient(0, CHART.y, 0, CHART.y + CHART.h)
    fill.addColorStop(0, up ? 'rgb(229 57 60 / 0.22)' : 'rgb(30 136 229 / 0.22)')
    fill.addColorStop(1, 'rgb(255 255 255 / 0)')
    c.fillStyle = fill
    c.fill()
    c.restore()

    // 시세 선
    c.save()
    c.strokeStyle = accent
    c.lineWidth = 4
    c.lineJoin = 'round'
    c.beginPath()
    for (let i = 0; i < history.length; i++) {
      const x = px(i)
      const y = py(history[i])
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    // 현재 지점
    const lastX = px(history.length - 1)
    const lastY = py(history[history.length - 1])
    c.fillStyle = accent
    c.beginPath()
    c.arc(lastX, lastY, 8, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.25
    c.beginPath()
    c.arc(lastX, lastY, 16, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // 현재가
    c.textAlign = 'center'
    c.fillStyle = '#263238'
    c.font = 'bold 40px sans-serif'
    c.fillText(money(state.price), 360, CHART.y + CHART.h + 56)
    c.fillStyle = '#90A4AE'
    c.font = '19px sans-serif'
    c.fillText(t('stock.price'), 360, CHART.y + CHART.h + 86)

    // 뉴스 배너
    if (state.eventText) {
      c.save()
      c.fillStyle = state.drift > 0 ? 'rgb(229 57 60 / 0.1)' : 'rgb(30 136 229 / 0.1)'
      c.beginPath()
      c.roundRect(40, 838, 640, 64, 18)
      c.fill()
      c.strokeStyle = state.drift > 0 ? 'rgb(229 57 60 / 0.35)' : 'rgb(30 136 229 / 0.35)'
      c.lineWidth = 2
      c.stroke()
      c.restore()
      c.fillStyle = state.drift > 0 ? '#C62828' : '#1565C0'
      c.font = 'bold 25px sans-serif'
      c.fillText(t(state.eventText), 360, 879)
    }

    // 보유 현황
    c.save()
    c.fillStyle = 'rgb(255 255 255 / 0.8)'
    c.beginPath()
    c.roundRect(40, 930, 640, 60, 18)
    c.fill()
    c.restore()
    c.fillStyle = '#546E7A'
    c.font = '22px sans-serif'
    c.fillText(
      t('stock.holdings', { c: money(Math.round(state.cash)), q: state.qty.toLocaleString() }),
      360,
      969,
    )

    // 매수/매도 버튼
    for (const button of BUTTONS) {
      const isBuy = button.action === 'buy'
      const enabled =
        state.phase === 'playing' &&
        (isBuy ? state.cash >= state.price : state.qty > 0)
      c.save()
      if (!enabled) c.globalAlpha = 0.4
      c.fillStyle = isBuy ? '#B71C1C' : '#0D47A1'
      c.beginPath()
      c.roundRect(button.x, button.y + 5, button.w, button.h, 20)
      c.fill()
      c.fillStyle = isBuy ? '#E5393C' : '#1E88E5'
      c.beginPath()
      c.roundRect(button.x, button.y, button.w, button.h, 20)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 30px sans-serif'
      c.fillText(t(button.label), button.x + button.w / 2, button.y + button.h / 2 + 11)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  // 시간제한 자산형 — 고점에서 이탈하면 이득이 되므로 시간을 다 썼을 때만 기록한다
  return shell
}

export default defineGame(createSession)
