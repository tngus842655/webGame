import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BOUNDS,
  COLORS,
  DOCK_R,
  activeDocks,
  clearCrashPair,
  createState,
  extendPath,
  grabBoat,
  update,
  type Boat,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.docked > 0) {
      playMerge(Math.min(6, 2 + state.combo))
      vibrate(12)
    }
    if (events.crashed) vibrate([40, 60, 80])
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let dragging: Boat | null = null
  let adClearUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'pb.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adClearUsed = false
      dragging = null
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adClearUsed) return
    const rewarded = await ctx.showRewardAd('paperboat-clear-pair')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adClearUsed = true
    clearCrashPair(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adClearUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      dragging = grabBoat(state, p.x, p.y)
      if (dragging) playDrop()
    },
    onMove(clientX, clientY) {
      if (!dragging || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      extendPath(dragging, p.x, p.y)
    },
    onUp() {
      dragging = null
    },
  })

  const drawBoat = (boat: Boat, highlight: boolean) => {
    const c = stage.c
    c.save()
    c.translate(boat.x, boat.y)
    c.rotate(boat.heading)
    // 종이배: 뱃머리가 진행 방향, 가운데 접힌 선
    c.beginPath()
    c.moveTo(20, 0)
    c.lineTo(-13, -15)
    c.lineTo(-8, 0)
    c.lineTo(-13, 15)
    c.closePath()
    c.fillStyle = COLORS[boat.color]
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.22)'
    c.lineWidth = 2
    c.stroke()
    c.strokeStyle = 'rgb(255 255 255 / 0.5)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(18, 0)
    c.lineTo(-8, 0)
    c.stroke()
    c.restore()

    if (highlight) {
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 3
      c.beginPath()
      c.arc(boat.x, boat.y, 30, 0, Math.PI * 2)
      c.stroke()
    }
  }

  const draw = () => {
    const c = stage.begin('#082638', '#0C3D58')

    // 물결
    c.strokeStyle = 'rgb(255 255 255 / 0.035)'
    c.lineWidth = 3
    for (let y = 260; y < 1280; y += 110) {
      c.beginPath()
      for (let x = 0; x <= 720; x += 24) c.lineTo(x, y + Math.sin((x + y) / 70) * 7)
      c.stroke()
    }

    // 부두
    for (const dock of activeDocks(state)) {
      const opening = state.dockFlash > 0 && state.docked === dock.appearAt
      c.save()
      c.translate(dock.x, dock.y)
      c.rotate(dock.angle)
      c.fillStyle = 'rgb(255 255 255 / 0.06)'
      c.fillRect(-46, -30, 46, 60)
      c.restore()

      c.beginPath()
      c.arc(dock.x, dock.y, DOCK_R, 0, Math.PI * 2)
      c.fillStyle = `${COLORS[dock.color]}2B`
      c.fill()
      c.lineWidth = opening ? 7 : 4
      c.strokeStyle = opening
        ? `rgb(255 255 255 / ${0.4 + 0.6 * Math.sin(state.dockFlash * 14)})`
        : COLORS[dock.color]
      c.stroke()
      c.beginPath()
      c.arc(dock.x, dock.y, 12, 0, Math.PI * 2)
      c.fillStyle = COLORS[dock.color]
      c.fill()
    }

    // 항로
    for (const boat of state.boats) {
      if (boat.path.length === 0) continue
      c.save()
      c.strokeStyle = COLORS[boat.color]
      c.globalAlpha = boat === dragging ? 0.9 : 0.5
      c.lineWidth = 4
      c.lineCap = 'round'
      c.setLineDash([12, 10])
      c.beginPath()
      c.moveTo(boat.x, boat.y)
      for (const p of boat.path) c.lineTo(p.x, p.y)
      c.stroke()
      c.setLineDash([])
      const end = boat.path[boat.path.length - 1]
      c.beginPath()
      c.arc(end.x, end.y, 6, 0, Math.PI * 2)
      c.fillStyle = COLORS[boat.color]
      c.fill()
      c.restore()
    }

    for (const boat of state.boats) drawBoat(boat, boat === dragging)

    // 점수 팝업
    for (const pop of state.pops) {
      c.save()
      c.globalAlpha = 1 - pop.age
      c.fillStyle = '#FFECB3'
      c.font = font(30, true)
      c.textAlign = 'center'
      c.fillText(pop.text, pop.x, pop.y - 60 - pop.age * 30)
      c.restore()
    }

    if (state.crash) {
      c.save()
      c.globalAlpha = 0.8
      c.strokeStyle = '#FF7043'
      c.lineWidth = 6
      c.beginPath()
      c.arc(state.crash.x, state.crash.y, 34, 0, Math.PI * 2)
      c.stroke()
      c.beginPath()
      c.moveTo(state.crash.x - 20, state.crash.y - 20)
      c.lineTo(state.crash.x + 20, state.crash.y + 20)
      c.moveTo(state.crash.x + 20, state.crash.y - 20)
      c.lineTo(state.crash.x - 20, state.crash.y + 20)
      c.stroke()
      c.restore()
    }

    // 못 경계
    c.strokeStyle = 'rgb(255 255 255 / 0.07)'
    c.lineWidth = 2
    c.strokeRect(BOUNDS.x0 - 10, BOUNDS.y0 - 10, BOUNDS.x1 - BOUNDS.x0 + 20, BOUNDS.y1 - BOUNDS.y0 + 20)

    // 첫 배를 보내기 전까지만 조작을 알려 준다 (입력이 한눈에 보이지 않는 게임이라)
    if (state.docked === 0) {
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = font(22)
      c.textAlign = 'center'
      c.fillText(t('pb.hint'), 360, 1150)
    }

    // HUD: 점수 + 콤보
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: state.combo >= 2,
    })
    if (state.combo >= 2) {
      c.fillStyle = '#FFD54F'
      c.font = font(26, true)
      c.fillText(`x${state.combo}`, SCORE_PANEL.cx, SCORE_PANEL.subY)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
