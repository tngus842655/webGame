import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { createState, lockTiming, pickTopic, update, ROUNDS } from './state'

const ICONS = ['🎮', '🍜', '📷', '🎵', '💪', '🍳', '✈️', '📦']
const TOPIC_KEYS: TranslationKey[] = [
  'tb.t1', 'tb.t2', 'tb.t3', 'tb.t4', 'tb.t5', 'tb.t6', 'tb.t7', 'tb.t8',
]
const STEP_KEYS: TranslationKey[] = ['tb.s1', 'tb.s2', 'tb.s3']

// 화면 배치 (논리 720×1280)
const CARD_X = 60
const CARD_W = 600
const CARD_H = 220
const CARD_GAP = 28
const PICK_Y = 340
const BAR = { x: 60, y: 700, w: 600, h: 64 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    trendFlash = Math.max(0, trendFlash - dt)
    const events = update(state, dt)
    if (events.trendChanged) {
      playMerge(4)
      trendFlash = 1.2
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let trendFlash = 0
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'tb.ad',
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
    const rewarded = await ctx.showRewardAd('tuber-time')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.timeLeft = 45
    state.phase = 'pick'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.subs)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.subs, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase === 'pick') {
        for (let i = 0; i < 3; i++) {
          const y = PICK_Y + i * (CARD_H + CARD_GAP)
          if (p.x >= CARD_X && p.x <= CARD_X + CARD_W && p.y >= y && p.y <= y + CARD_H) {
            pickTopic(state, i)
            playDrop()
            return
          }
        }
      } else if (state.phase === 'timing') {
        const acc = lockTiming(state)
        if (acc !== null) {
          playMerge(acc > 0.7 ? 5 : acc > 0.4 ? 3 : 1)
          vibrate(acc > 0.7 ? 25 : 10)
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#B71C1C', '#FCE4EC')

    // HUD: 구독자 + 트렌드 + 타이머
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.95
    c.beginPath()
    c.roundRect(120, 20, 480, 148, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#EF9A9A'
    c.font = '18px sans-serif'
    c.fillText(t('tb.subs'), 360, 52)
    c.fillStyle = '#B71C1C'
    c.font = 'bold 50px sans-serif'
    c.fillText(state.subs.toLocaleString(), 360, 108)
    c.font = '24px sans-serif'
    c.fillStyle = '#E57373'
    const low = state.timeLeft < 30
    c.fillStyle = low ? '#D32F2F' : '#E57373'
    c.textAlign = 'right'
    const mm = Math.floor(state.timeLeft / 60)
    const ss = String(Math.floor(state.timeLeft % 60)).padStart(2, '0')
    c.fillText(`⏱ ${mm}:${ss}`, 568, 148)
    c.textAlign = 'center'

    // 트렌드 배너
    c.save()
    if (trendFlash > 0) c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(state.playTime * 10))
    c.fillStyle = '#FFF3E0'
    c.beginPath()
    c.roundRect(120, 190, 480, 64, 18)
    c.fill()
    c.fillStyle = '#E65100'
    c.font = 'bold 28px sans-serif'
    c.textBaseline = 'middle'
    c.fillText(
      `🔥 ${t('tb.trend', { name: `${ICONS[state.trend]} ${t(TOPIC_KEYS[state.trend])}` })}`,
      360,
      224,
    )
    c.restore()
    c.textBaseline = 'alphabetic'

    if (state.phase === 'pick') {
      c.fillStyle = '#880E4F'
      c.font = 'bold 32px sans-serif'
      c.fillText(t('tb.pick'), 360, 316)
      for (let i = 0; i < 3; i++) {
        const topic = state.topics[i]
        const y = PICK_Y + i * (CARD_H + CARD_GAP)
        const hot = topic === state.trend
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.roundRect(CARD_X, y, CARD_W, CARD_H, 22)
        c.fill()
        if (hot) {
          c.strokeStyle = '#FF6F00'
          c.lineWidth = 5
          c.beginPath()
          c.roundRect(CARD_X + 3, y + 3, CARD_W - 6, CARD_H - 6, 19)
          c.stroke()
        }
        c.font = '72px sans-serif'
        c.fillText(ICONS[topic], CARD_X + 110, y + 140)
        c.fillStyle = '#3E2723'
        c.font = 'bold 40px sans-serif'
        c.textAlign = 'left'
        c.fillText(t(TOPIC_KEYS[topic]), CARD_X + 200, y + 120)
        if (hot) {
          c.fillStyle = '#FF6F00'
          c.font = 'bold 26px sans-serif'
          c.fillText(t('tb.hot'), CARD_X + 200, y + 164)
        }
        c.textAlign = 'center'
      }
    } else if (state.phase === 'timing') {
      // 단계 라벨 + 진행 점
      c.fillStyle = '#880E4F'
      c.font = 'bold 44px sans-serif'
      c.fillText(`${ICONS[state.chosen]} ${t(STEP_KEYS[state.round])}`, 360, 560)
      for (let r = 0; r < ROUNDS; r++) {
        c.fillStyle = r < state.round ? '#66BB6A' : r === state.round ? '#FF6F00' : '#E0E0E0'
        c.beginPath()
        c.arc(300 + r * 60, 610, 12, 0, Math.PI * 2)
        c.fill()
      }
      // 타이밍 바
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.roundRect(BAR.x, BAR.y, BAR.w, BAR.h, 20)
      c.fill()
      const zx = BAR.x + (state.zoneCenter - state.zoneHalf) * BAR.w
      c.fillStyle = '#A5D6A7'
      c.beginPath()
      c.roundRect(zx, BAR.y, state.zoneHalf * 2 * BAR.w, BAR.h, 12)
      c.fill()
      c.fillStyle = '#43A047'
      c.fillRect(BAR.x + state.zoneCenter * BAR.w - 3, BAR.y, 6, BAR.h)
      // 커서
      const cx = BAR.x + state.cursor * BAR.w
      c.fillStyle = '#D32F2F'
      c.beginPath()
      c.moveTo(cx, BAR.y - 6)
      c.lineTo(cx - 16, BAR.y - 34)
      c.lineTo(cx + 16, BAR.y - 34)
      c.closePath()
      c.fill()
      c.fillRect(cx - 3, BAR.y, 6, BAR.h)
      c.fillStyle = '#AD1457'
      c.font = '26px sans-serif'
      c.fillText(t('tb.tap'), 360, BAR.y + 140)
    } else if (state.phase === 'result') {
      const k = Math.min(1, (2.2 - state.resultTimer) / 0.9)
      c.fillStyle = '#3E2723'
      c.font = 'bold 40px sans-serif'
      c.fillText(t('tb.views', { n: Math.floor(state.lastViews * k).toLocaleString() }), 360, 640)
      c.fillStyle = '#D32F2F'
      c.font = 'bold 56px sans-serif'
      c.fillText(`+${Math.floor(state.lastSubs * k).toLocaleString()} 🔔`, 360, 730)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
