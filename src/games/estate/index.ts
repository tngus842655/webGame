import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { buy, createState, sell, totalAssets, update, PROPS } from './state'

// 화면 배치 (논리 720×1280): HUD → 이벤트 배너 → 매물 카드 6장
const CARD_X = 24
const CARD_W = 672
const CARD_H = 150
const CARD_GAP = 12
const LIST_Y = 288
const BTN_W = 128
const BTN_H = 56

const ICONS = ['🏠', '🏢', '🏪', '🏬', '🏗️', '🗼']
const NAME_KEYS: TranslationKey[] = ['es.p1', 'es.p2', 'es.p3', 'es.p4', 'es.p5', 'es.p6']

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.event) {
      playMerge(state.event?.up ? 5 : 1)
      vibrate(20)
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'es.ad',
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

  // 광고 보상: 45초 연장 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('estate-time')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.timeLeft = 45
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const score = Math.min(1_000_000, totalAssets(state))
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      for (let i = 0; i < PROPS.length; i++) {
        const y = LIST_Y + i * (CARD_H + CARD_GAP)
        if (p.y < y || p.y > y + CARD_H) continue
        const btnX = CARD_X + CARD_W - BTN_W - 16
        if (p.x < btnX || p.x > btnX + BTN_W) return
        if (p.y <= y + 12 + BTN_H) {
          if (buy(state, i)) {
            playDrop()
            vibrate(10)
          }
        } else if (p.y >= y + CARD_H - 12 - BTN_H) {
          if (sell(state, i)) {
            playDrop()
            vibrate(10)
          }
        }
        return
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#37474F', '#455A64')

    // HUD: 총자산 + 현금 + 남은 시간
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.95
    c.beginPath()
    c.roundRect(120, 20, 480, 148, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#90A4AE'
    c.font = '18px sans-serif'
    c.fillText(t('es.asset'), 360, 52)
    c.fillStyle = '#263238'
    c.font = 'bold 50px sans-serif'
    c.fillText(totalAssets(state).toLocaleString(), 360, 108)
    c.font = '24px sans-serif'
    c.fillStyle = '#78909C'
    c.textAlign = 'left'
    c.fillText(`💵 ${Math.floor(state.cash).toLocaleString()}`, 152, 148)
    const low = state.timeLeft < 30
    c.fillStyle = low ? '#E53935' : '#78909C'
    c.textAlign = 'right'
    const mm = Math.floor(state.timeLeft / 60)
    const ss = String(Math.floor(state.timeLeft % 60)).padStart(2, '0')
    c.fillText(`⏱ ${mm}:${ss}`, 568, 148)
    c.textAlign = 'center'

    // 이벤트 배너
    if (state.event) {
      const ev = state.event
      c.save()
      c.globalAlpha = Math.min(1, 4 - ev.age) * 0.95
      c.fillStyle = ev.up ? '#FFEBEE' : '#E3F2FD'
      c.beginPath()
      c.roundRect(60, 190, 600, 72, 18)
      c.fill()
      c.fillStyle = ev.up ? '#C62828' : '#1565C0'
      c.font = 'bold 28px sans-serif'
      c.textBaseline = 'middle'
      const name = ev.target >= 0 ? t(NAME_KEYS[ev.target]) : ''
      c.fillText(
        ev.target >= 0
          ? t(ev.up ? 'es.evUp' : 'es.evDown', { name })
          : t(ev.up ? 'es.evAllUp' : 'es.evAllDown'),
        360,
        226,
      )
      c.restore()
      c.textBaseline = 'alphabetic'
    }

    // 매물 카드
    for (let i = 0; i < PROPS.length; i++) {
      const prop = state.properties[i]
      const y = LIST_Y + i * (CARD_H + CARD_GAP)
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.roundRect(CARD_X, y, CARD_W, CARD_H, 18)
      c.fill()

      // 아이콘 + 이름 + 보유
      c.font = '44px sans-serif'
      c.textAlign = 'left'
      c.fillText(ICONS[i], CARD_X + 20, y + 62)
      c.fillStyle = '#263238'
      c.font = 'bold 30px sans-serif'
      c.fillText(t(NAME_KEYS[i]), CARD_X + 84, y + 48)
      c.fillStyle = '#78909C'
      c.font = '22px sans-serif'
      c.fillText(
        `${t('es.own', { n: prop.owned })} · +${Math.round(PROPS[i].base * PROPS[i].rate * prop.owned).toLocaleString()}/s`,
        CARD_X + 84,
        y + 82,
      )

      // 가격 + 등락
      const priceText = Math.round(prop.price).toLocaleString()
      c.fillStyle = '#263238'
      c.font = 'bold 32px sans-serif'
      c.fillText(priceText, CARD_X + 84, y + 126)
      const priceW = c.measureText(priceText).width
      const pct = prop.lastChange * 100
      c.fillStyle = pct >= 0 ? '#E5393C' : '#1E88E5'
      c.font = 'bold 22px sans-serif'
      c.fillText(`${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`, CARD_X + 96 + priceW, y + 126)

      // 매수/매도 버튼
      const btnX = CARD_X + CARD_W - BTN_W - 16
      const canBuy = state.cash >= prop.price
      c.fillStyle = canBuy ? '#E5393C' : '#CFD8DC'
      c.beginPath()
      c.roundRect(btnX, y + 12, BTN_W, BTN_H, 14)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 26px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(t('es.buy'), btnX + BTN_W / 2, y + 12 + BTN_H / 2 + 1)
      const canSell = prop.owned > 0
      c.fillStyle = canSell ? '#1E88E5' : '#CFD8DC'
      c.beginPath()
      c.roundRect(btnX, y + CARD_H - 12 - BTN_H, BTN_W, BTN_H, 14)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.fillText(t('es.sell'), btnX + BTN_W / 2, y + CARD_H - 12 - BTN_H / 2 - 1)
      c.textBaseline = 'alphabetic'
      c.textAlign = 'left'
    }
    c.textAlign = 'center'
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => totalAssets(state) }
}

export default defineGame(createSession)
