import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  MAX_MISS,
  createState,
  endStroke,
  extendStroke,
  resetMisses,
  startStroke,
  update,
  type Comet,
} from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.missed) {
      playDrop()
      vibrate(70)
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adResetUsed = false

  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: ((i * 149) % 73) * 10 + 6,
    y: ((i * 71) % 127) * 10 + 8,
    r: 0.8 + (i % 3) * 0.6,
  }))

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'cm.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adResetUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adResetUsed) return
    const rewarded = await ctx.showRewardAd('comet-reset-miss')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adResetUsed = true
    resetMisses(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adResetUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      startStroke(state, p.x, p.y)
    },
    onMove(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const cut = extendStroke(state, p.x, p.y)
      if (cut > 0) {
        playMerge(Math.min(6, 2 + (state.stroke?.cuts ?? 1)))
        vibrate(12)
      }
    },
    onUp() {
      const chain = endStroke(state)
      if (chain >= 3) vibrate([15, 35, 25])
    },
  })

  const drawComet = (comet: Comet) => {
    const c = stage.c
    for (let i = 1; i < comet.trail.length; i++) {
      const a = i / comet.trail.length
      c.save()
      c.globalAlpha = a * 0.5
      c.strokeStyle = '#FFB74D'
      c.lineWidth = comet.r * a * 0.9
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(comet.trail[i - 1].x, comet.trail[i - 1].y)
      c.lineTo(comet.trail[i].x, comet.trail[i].y)
      c.stroke()
      c.restore()
    }
    c.save()
    c.shadowColor = '#FFD54F'
    c.shadowBlur = 22
    c.fillStyle = '#FFE082'
    c.beginPath()
    c.arc(comet.x, comet.y, comet.r, 0, Math.PI * 2)
    c.fill()
    c.restore()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(comet.x - comet.r * 0.22, comet.y - comet.r * 0.22, comet.r * 0.42, 0, Math.PI * 2)
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#050A1E', '#0A1230')

    c.fillStyle = '#FFFFFF'
    for (const s of stars) {
      c.globalAlpha = 0.14 + (s.r - 0.8) * 0.2
      c.beginPath()
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    for (const comet of state.comets) drawComet(comet)

    // 터진 자리
    for (const burst of state.bursts) {
      const p = burst.age / 0.5
      c.save()
      c.globalAlpha = 1 - p
      c.strokeStyle = '#FFECB3'
      c.lineWidth = 5 * (1 - p) + 1
      c.beginPath()
      c.arc(burst.x, burst.y, 20 + p * 52, 0, Math.PI * 2)
      c.stroke()
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + burst.age
        const d = 24 + p * 60
        c.beginPath()
        c.arc(burst.x + Math.cos(a) * d, burst.y + Math.sin(a) * d, 4 * (1 - p) + 1, 0, Math.PI * 2)
        c.fillStyle = '#FFD54F'
        c.fill()
      }
      c.restore()
    }

    // 그은 궤적
    const stroke = state.stroke
    if (stroke && stroke.points.length > 1) {
      c.save()
      c.globalAlpha = stroke.active ? 1 : 1 - stroke.age / 0.35
      c.shadowColor = '#4DD0E1'
      c.shadowBlur = 16
      c.strokeStyle = '#B2EBF2'
      c.lineWidth = 7
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (const p of stroke.points) c.lineTo(p.x, p.y)
      c.stroke()
      c.restore()
    }

    for (const pop of state.pops) {
      c.save()
      c.globalAlpha = Math.max(0, 1 - pop.age / 1.1)
      c.fillStyle = '#FFF59D'
      c.font = 'bold 34px sans-serif'
      c.textAlign = 'center'
      c.fillText(pop.text, pop.x, pop.y - 40 - pop.age * 40)
      c.restore()
    }

    // HUD: 점수 + 놓친 개수 + 최다 연결
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.09
    c.beginPath()
    c.roundRect(160, 22, 400, 128, 24)
    c.fill()
    c.restore()
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 54)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 46px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 108)
    c.font = '20px sans-serif'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    if (state.bestChain >= 2) c.fillText(t('cm.chain', { n: state.bestChain }), 360, 140)

    // 놓친 개수는 남은 기회로 보여 준다
    c.font = 'bold 30px sans-serif'
    c.fillStyle = '#FF8A65'
    c.fillText('✕'.repeat(state.misses) + '·'.repeat(Math.max(0, MAX_MISS - state.misses)), 620, 66)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
