import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { BUBBLE_R, createState, reviveAtLevel, tapAt, update, type Bubble } from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'fn.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('flashnum-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveAtLevel(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const result = tapAt(state, p.x, p.y)
      if (result === 'correct') {
        playMerge(Math.min(6, state.next))
        vibrate(10)
      } else if (result === 'clear') {
        playMerge(7)
        vibrate([15, 40, 25])
      } else if (result === 'wrong') {
        playDrop()
        vibrate(110)
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawBubble = (b: Bubble, showNumber: boolean) => {
    const c = stage.c
    if (b.popped) {
      if (b.pop >= 1) return
      // 터지는 순간: 고리가 퍼지며 사라진다
      c.save()
      c.globalAlpha = 1 - b.pop
      c.strokeStyle = '#B3E5FC'
      c.lineWidth = 6 * (1 - b.pop) + 1
      c.beginPath()
      c.arc(b.x, b.y, BUBBLE_R * (1 + b.pop * 0.6), 0, Math.PI * 2)
      c.stroke()
      c.restore()
      return
    }

    const isNext = b.n === state.next
    c.beginPath()
    c.arc(b.x, b.y, BUBBLE_R, 0, Math.PI * 2)
    if (b.wrong) c.fillStyle = 'rgb(239 83 80 / 0.85)'
    else if (showNumber) c.fillStyle = '#4FC3F7'
    else c.fillStyle = 'rgb(255 255 255 / 0.12)'
    c.fill()
    c.lineWidth = state.phase === 'penalty' && isNext ? 6 : 3
    c.strokeStyle =
      state.phase === 'penalty' && isNext
        ? '#66BB6A'
        : showNumber
          ? 'rgb(255 255 255 / 0.55)'
          : 'rgb(255 255 255 / 0.3)'
    c.stroke()

    // 물방울 광택
    if (showNumber || b.wrong) {
      c.save()
      c.globalAlpha = 0.4
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(b.x - 16, b.y - 22, 15, 10, -0.5, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    if (showNumber) {
      c.fillStyle = b.wrong ? '#FFFFFF' : '#06323F'
      c.font = 'bold 46px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(b.n), b.x, b.y + 2)
      c.textBaseline = 'alphabetic'
    }
  }

  const draw = () => {
    const c = stage.begin('#062330', '#0C3B4C')

    // 물결 — 배경이 비어 보이지 않게 아주 옅게
    c.strokeStyle = 'rgb(255 255 255 / 0.03)'
    c.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      c.beginPath()
      c.arc(360, 700, 120 + i * 110, 0, Math.PI * 2)
      c.stroke()
    }

    const showNumbers = state.phase === 'reveal' || state.phase === 'penalty'
    for (const b of state.bubbles) drawBubble(b, showNumbers)

    c.textAlign = 'center'

    // 노출 시간 막대 — 얼마나 더 볼 수 있는지 보여 준다
    if (state.phase === 'reveal') {
      const w = 400
      c.fillStyle = 'rgb(255 255 255 / 0.12)'
      c.beginPath()
      c.roundRect(360 - w / 2, 236, w, 12, 6)
      c.fill()
      c.fillStyle = '#FFD54F'
      c.beginPath()
      c.roundRect(360 - w / 2, 236, w * (state.showTimer / state.showSpan), 12, 6)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.75)'
      c.font = '22px sans-serif'
      c.fillText(t('fn.memorize'), 360, 218)
    } else if (state.phase === 'recall' && state.level <= 2) {
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = '22px sans-serif'
      c.fillText(t('fn.order'), 360, 240)
    }

    if (state.phase === 'clear') {
      c.fillStyle = '#FFD54F'
      c.font = 'bold 38px sans-serif'
      c.fillText(`+${state.gain}`, 360, 240)
    }

    // HUD: 점수 + 단계 + 하트
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(160, 24, 400, 130, 24)
    c.fill()
    c.restore()
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(`${t('hud.score')} · ${t('fn.level', { n: state.level })}`, 360, 56)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 112)
    c.font = 'bold 26px sans-serif'
    c.fillText('❤'.repeat(state.hearts), 360, 144)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
