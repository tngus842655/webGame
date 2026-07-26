import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  createState,
  order,
  restock,
  update,
  PRODUCTS,
  SHELF_CAP,
  ORDER_UNITS,
  DELIVERY_TIME,
} from './state'

// 화면 배치 (논리 720×1280): 상품별 세로 열 — 진열대 / 손님 줄 / 발주 버튼
const COL_X = [114, 278, 442, 606] // 열 중심
const CARD_W = 152
const SHELF_Y = 240
const SHELF_H = 250
const QUEUE_Y = 585 // 첫 손님 위치
const QUEUE_GAP = 88
const ORDER_Y = 1090
const ORDER_H = 116

const ICONS = ['🥤', '🍙', '🍜', '🍫']

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    repFlash = Math.max(0, repFlash - dt)
    const events = update(state, dt)
    for (const product of events.sales) {
      playMerge(3)
      popups.push({ x: COL_X[product], y: QUEUE_Y - 50, text: `+${PRODUCTS[product].price}`, age: 0 })
    }
    if (events.angry) {
      vibrate(80)
      repFlash = 0.5
    }
    if (events.delivered) playDrop()
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age > 0.9) popups.splice(i, 1)
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  const popups: Array<{ x: number; y: number; text: string; age: number }> = []
  let repFlash = 0
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'st.ad',
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

  // 광고 보상: 평판 3으로 회복하고 이어서 운영 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('store-rep')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.rep = 3
    state.customers = []
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.revenue)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.revenue, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      for (let i = 0; i < PRODUCTS.length; i++) {
        if (Math.abs(p.x - COL_X[i]) > CARD_W / 2) continue
        if (p.y >= SHELF_Y && p.y <= SHELF_Y + SHELF_H) {
          if (restock(state, i)) {
            playDrop()
            vibrate(10)
          }
          return
        }
        if (p.y >= ORDER_Y && p.y <= ORDER_Y + ORDER_H) {
          if (order(state, i)) {
            playDrop()
            vibrate(10)
          }
          return
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#4E342E', '#6D4C41')

    // 바닥 (손님 공간)
    c.fillStyle = '#8D6E63'
    c.fillRect(0, SHELF_Y + SHELF_H + 24, 720, 1280 - SHELF_Y - SHELF_H - 24)

    // HUD: 매출 + 현금 + 평판
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.95
    c.beginPath()
    c.roundRect(120, 20, 480, 148, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#BCAAA4'
    c.font = '18px sans-serif'
    c.fillText(t('st.revenue'), 360, 52)
    c.fillStyle = '#3E2723'
    c.font = 'bold 50px sans-serif'
    c.fillText(state.revenue.toLocaleString(), 360, 108)
    c.font = '24px sans-serif'
    c.fillStyle = '#8D6E63'
    c.textAlign = 'left'
    c.fillText(`💵 ${Math.floor(state.cash).toLocaleString()}`, 152, 148)
    c.textAlign = 'right'
    c.fillStyle = repFlash > 0 ? '#E53935' : '#8D6E63'
    c.fillText(`${'❤'.repeat(state.rep)}${'♡'.repeat(Math.max(0, 5 - state.rep))}`, 568, 148)
    c.textAlign = 'center'

    // 진열대 카드
    for (let i = 0; i < PRODUCTS.length; i++) {
      const shelf = state.shelves[i]
      const x = COL_X[i] - CARD_W / 2
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.roundRect(x, SHELF_Y, CARD_W, SHELF_H, 16)
      c.fill()
      if (shelf.display === 0) {
        // 빈 진열대 경고 테두리
        c.strokeStyle = '#E53935'
        c.lineWidth = 4
        c.beginPath()
        c.roundRect(x + 2, SHELF_Y + 2, CARD_W - 4, SHELF_H - 4, 14)
        c.stroke()
      }
      c.font = '52px sans-serif'
      c.fillText(ICONS[i], COL_X[i], SHELF_Y + 66)
      // 진열 슬롯 5칸
      for (let s = 0; s < SHELF_CAP; s++) {
        const sx = x + 20 + s * 24
        c.fillStyle = s < shelf.display ? '#66BB6A' : '#ECEFF1'
        c.beginPath()
        c.roundRect(sx, SHELF_Y + 96, 18, 18, 5)
        c.fill()
      }
      c.fillStyle = '#8D6E63'
      c.font = 'bold 22px sans-serif'
      c.fillText(t('st.stock', { n: shelf.stock }), COL_X[i], SHELF_Y + 156)
      c.fillStyle = '#3E2723'
      c.font = 'bold 24px sans-serif'
      c.fillText(`${PRODUCTS[i].price}`, COL_X[i], SHELF_Y + 196)
      c.fillStyle = '#BCAAA4'
      c.font = '18px sans-serif'
      c.fillText('▼', COL_X[i], SHELF_Y + 226)
    }

    // 손님
    for (const customer of state.customers) {
      const x = COL_X[customer.product]
      let y = QUEUE_Y + customer.slot * QUEUE_GAP
      let alpha = 1
      if (customer.mood === 'in') {
        const k = Math.min(1, customer.t / 1)
        y = y + (1 - k) * 300
      } else if (customer.mood === 'happy' || customer.mood === 'angry') {
        const k = Math.min(1, customer.t / 0.9)
        alpha = 1 - k
        y += k * 120
      }
      if (y > 1260) continue
      c.save()
      c.globalAlpha = alpha
      // 몸통
      c.fillStyle =
        customer.mood === 'happy' ? '#A5D6A7' : customer.mood === 'angry' ? '#EF9A9A' : '#FFCC80'
      c.beginPath()
      c.arc(x, y, 32, 0, Math.PI * 2)
      c.fill()
      // 표정
      c.fillStyle = '#3E2723'
      c.beginPath()
      c.arc(x - 10, y - 6, 3.5, 0, Math.PI * 2)
      c.arc(x + 10, y - 6, 3.5, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = '#3E2723'
      c.lineWidth = 3
      c.beginPath()
      if (customer.mood === 'happy') {
        c.arc(x, y + 6, 9, 0.15 * Math.PI, 0.85 * Math.PI)
      } else if (customer.mood === 'angry') {
        c.arc(x, y + 16, 9, 1.15 * Math.PI, 1.85 * Math.PI)
      } else {
        c.moveTo(x - 7, y + 10)
        c.lineTo(x + 7, y + 10)
      }
      c.stroke()
      // 기다리는 손님: 원하는 상품 말풍선 + 인내심 링
      if (customer.mood === 'wait') {
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.roundRect(x + 24, y - 66, 56, 48, 14)
        c.fill()
        c.font = '28px sans-serif'
        c.fillText(ICONS[customer.product], x + 52, y - 30)
        const left = 1 - customer.t / customer.patience
        c.strokeStyle = left > 0.5 ? '#66BB6A' : left > 0.25 ? '#FFA726' : '#E53935'
        c.lineWidth = 5
        c.beginPath()
        c.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2)
        c.stroke()
      }
      c.restore()
    }

    // 판매 팝업
    for (const popup of popups) {
      c.save()
      c.globalAlpha = 1 - popup.age / 0.9
      c.font = 'bold 30px sans-serif'
      c.fillStyle = '#FFF176'
      c.fillText(popup.text, popup.x, popup.y - popup.age * 60)
      c.restore()
    }

    // 발주 버튼
    for (let i = 0; i < PRODUCTS.length; i++) {
      const x = COL_X[i] - CARD_W / 2
      const cost = PRODUCTS[i].cost * ORDER_UNITS
      const pending = state.orders.filter((o) => o.product === i)
      const affordable = state.cash >= cost
      c.fillStyle = affordable ? '#43A047' : '#90A4AE'
      c.beginPath()
      c.roundRect(x, ORDER_Y, CARD_W, ORDER_H, 16)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 24px sans-serif'
      c.fillText(t('st.order', { n: cost }), COL_X[i], ORDER_Y + 44)
      c.font = '20px sans-serif'
      if (pending.length > 0) {
        // 가장 임박한 배송의 진행 바
        const next = Math.min(...pending.map((o) => o.timer))
        c.fillText(`🚚 ${next.toFixed(1)}s${pending.length > 1 ? ` ×${pending.length}` : ''}`, COL_X[i], ORDER_Y + 82)
        c.fillStyle = 'rgb(255 255 255 / 0.35)'
        c.fillRect(x + 14, ORDER_Y + 98, (CARD_W - 28) * (1 - next / DELIVERY_TIME), 6)
      } else {
        c.fillText(`+${ORDER_UNITS}`, COL_X[i], ORDER_Y + 82)
      }
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
