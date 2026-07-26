import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { DISCS, DISC_R, GAUGE_MAX, createState, reviveWithTime, tapAt, update } from './state'
import { SYMBOLS } from './symbols'

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
    adLabelKey: 'sp.ad',
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
    const rewarded = await ctx.showRewardAd('samepic-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveWithTime(state)
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
        playMerge(Math.min(6, 2 + Math.floor(state.combo / 3)))
        vibrate(12)
      } else if (result === 'wrong') {
        playDrop()
        vibrate(90)
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#1A1330', '#241A42')

    for (let d = 0; d < DISCS.length; d++) {
      const disc = DISCS[d]
      c.beginPath()
      c.arc(disc.x, disc.y, DISC_R, 0, Math.PI * 2)
      c.fillStyle = '#FFF8E1'
      c.fill()
      c.lineWidth = 5
      c.strokeStyle = 'rgb(0 0 0 / 0.28)'
      c.stroke()

      for (const p of state.discs[d]) {
        c.save()
        c.translate(disc.x + p.x, disc.y + p.y)
        c.rotate(p.rot)
        SYMBOLS[p.sym].draw(c, p.r)
        c.restore()
        // 정답을 맞힌 직후 양쪽 원판의 같은 그림에 표를 남긴다
        if (state.phase === 'resolve' && p.sym === state.answer) {
          c.strokeStyle = '#43A047'
          c.lineWidth = 5
          c.beginPath()
          c.arc(disc.x + p.x, disc.y + p.y, p.r + 12, 0, Math.PI * 2)
          c.stroke()
        }
      }
    }

    if (state.wrongFlash > 0 && state.wrongAt) {
      c.save()
      c.globalAlpha = state.wrongFlash / 0.4
      c.strokeStyle = '#E53935'
      c.lineWidth = 5
      c.beginPath()
      c.arc(state.wrongAt.x, state.wrongAt.y, 46, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    // HUD: 점수·콤보 + 시간 게이지
    c.textAlign = 'center'
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 44px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 62)
    if (state.combo >= 2) {
      c.fillStyle = '#FFD54F'
      c.font = 'bold 28px sans-serif'
      c.textAlign = 'left'
      c.fillText(`x${state.combo}`, 470, 60)
      c.textAlign = 'center'
    }

    const gw = 600
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    c.beginPath()
    c.roundRect(60, 92, gw, 22, 11)
    c.fill()
    const ratio = state.gauge / GAUGE_MAX
    c.fillStyle = state.gauge < 5 ? '#EF5350' : state.gauge < 10 ? '#FFB300' : '#66BB6A'
    c.beginPath()
    c.roundRect(60, 92, Math.max(6, gw * ratio), 22, 11)
    c.fill()

    if (state.round <= 2) {
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = '22px sans-serif'
      c.fillText(t('sp.hint'), 360, 1242)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
