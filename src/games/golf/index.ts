import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BALL_R,
  FIELD,
  HOLE_R,
  LEVELS,
  MAX_POWER,
  createState,
  currentLevel,
  holePoints,
  loadHole,
  stepBall,
} from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      if (state.sunkTimer > 0) {
        state.sunkTimer -= dt
        if (state.sunkTimer <= 0) {
          if (state.holeIndex + 1 >= LEVELS.length) {
            state.phase = 'over'
            void courseComplete()
          } else {
            loadHole(state, state.holeIndex + 1)
          }
        }
      } else if (state.moving) {
        const result = stepBall(state, dt)
        if (result.sunk) onSunk()
      }
    }
    state.playTime += dt
    if (sunkPopup) {
      sunkPopup.age += dt
      if (sunkPopup.age > 0.9) sunkPopup = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let dragStart: { x: number; y: number } | null = null
  let sunkPopup: { text: string; age: number } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    onRetry() {
      if (state.phase !== 'over') return
      Object.assign(state, createState())
      overlay.hide()
    },
  })

  async function courseComplete() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, false)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing' || state.moving || state.sunkTimer > 0) return
      dragStart = stage.toBoard(clientX, clientY)
    },
    onMove(clientX, clientY) {
      if (!dragStart) return
      const p = stage.toBoard(clientX, clientY)
      const dx = dragStart.x - p.x
      const dy = dragStart.y - p.y
      const len = Math.hypot(dx, dy)
      state.aim = len < 20 ? null : { dx: dx / len, dy: dy / len, power: Math.min(len, 360) / 360 }
    },
    onUp() {
      dragStart = null
      if (state.phase !== 'playing' || state.moving || !state.aim) return
      const { dx, dy, power } = state.aim
      state.ball.vx = dx * power * MAX_POWER
      state.ball.vy = dy * power * MAX_POWER
      state.moving = true
      state.strokes += 1
      state.aim = null
      playDrop()
    },
  })

  const onSunk = () => {
    const points = holePoints(state.strokes)
    state.score += points
    sunkPopup = { text: `+${points}`, age: 0 }
    playMerge(3)
    vibrate(30)
    state.sunkTimer = 0.9
  }

  const draw = () => {
    const c = stage.begin('#8FA86B', '#EAF3DA')
    const level = currentLevel(state)

    // 배경
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#EAF6DC')
    sky.addColorStop(1, '#D6E7C0')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)

    // 잔디 필드
    const fx = FIELD.left - 16
    const fy = FIELD.top - 16
    const fw = FIELD.right - FIELD.left + 32
    const fh = FIELD.bottom - FIELD.top + 32
    c.save()
    c.fillStyle = '#6FBF63'
    c.beginPath()
    c.roundRect(fx, fy, fw, fh, 26)
    c.fill()
    // 잔디 깎은 줄무늬
    c.save()
    c.beginPath()
    c.roundRect(fx, fy, fw, fh, 26)
    c.clip()
    c.fillStyle = 'rgb(255 255 255 / 0.07)'
    for (let sy = fy; sy < fy + fh; sy += 92) c.fillRect(fx, sy, fw, 46)
    c.restore()
    c.strokeStyle = '#4E8C46'
    c.lineWidth = 8
    c.stroke()
    c.restore()

    // 벽 (나무 블록)
    for (const wall of level.walls) {
      c.save()
      c.fillStyle = '#5D4037'
      c.beginPath()
      c.roundRect(wall.x, wall.y + 5, wall.w, wall.h, 9)
      c.fill()
      const grad = c.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h)
      grad.addColorStop(0, '#A1795A')
      grad.addColorStop(1, '#7A5439')
      c.fillStyle = grad
      c.beginPath()
      c.roundRect(wall.x, wall.y, wall.w, wall.h, 9)
      c.fill()
      c.restore()
    }

    // 홀
    const [hx, hy] = level.hole
    c.save()
    c.fillStyle = 'rgb(0 0 0 / 0.18)'
    c.beginPath()
    c.ellipse(hx, hy + 4, HOLE_R + 6, HOLE_R + 3, 0, 0, Math.PI * 2)
    c.fill()
    const holeGrad = c.createRadialGradient(hx, hy - HOLE_R * 0.3, 2, hx, hy, HOLE_R)
    holeGrad.addColorStop(0, '#111111')
    holeGrad.addColorStop(1, '#2E2E2E')
    c.fillStyle = holeGrad
    c.beginPath()
    c.arc(hx, hy, HOLE_R, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // 깃대
    c.save()
    c.strokeStyle = '#ECEFF1'
    c.lineWidth = 5
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(hx, hy - 4)
    c.lineTo(hx, hy - 74)
    c.stroke()
    const wave = Math.sin(state.playTime * 4) * 4
    c.fillStyle = '#E53935'
    c.beginPath()
    c.moveTo(hx, hy - 74)
    c.quadraticCurveTo(hx + 22, hy - 68 + wave, hx + 40, hy - 58)
    c.quadraticCurveTo(hx + 20, hy - 52 - wave, hx, hy - 44)
    c.closePath()
    c.fill()
    c.restore()

    // 조준 (파워에 따라 색·길이 변화)
    if (state.aim && !state.moving) {
      const power = state.aim.power
      c.save()
      const strong = power > 0.66
      c.fillStyle = strong ? '#EF5350' : power > 0.33 ? '#FFB300' : '#FFF176'
      const dist = 110 + power * 340
      for (let d = 34; d <= dist; d += 32) {
        c.globalAlpha = Math.max(0.2, 1 - d / (dist + 90))
        c.beginPath()
        c.arc(state.ball.x + state.aim.dx * d, state.ball.y + state.aim.dy * d, 6, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()

      // 파워 게이지
      c.save()
      c.translate(state.ball.x, state.ball.y + 40)
      c.fillStyle = 'rgb(0 0 0 / 0.2)'
      c.beginPath()
      c.roundRect(-46, 0, 92, 12, 6)
      c.fill()
      c.fillStyle = power > 0.66 ? '#EF5350' : power > 0.33 ? '#FFB300' : '#8BC34A'
      c.beginPath()
      c.roundRect(-46, 0, 92 * power, 12, 6)
      c.fill()
      c.restore()
    }

    // 공
    c.save()
    c.fillStyle = 'rgb(0 0 0 / 0.16)'
    c.beginPath()
    c.ellipse(state.ball.x + 2, state.ball.y + BALL_R * 0.85, BALL_R * 0.95, BALL_R * 0.4, 0, 0, Math.PI * 2)
    c.fill()
    const ballGrad = c.createRadialGradient(
      state.ball.x - BALL_R * 0.35,
      state.ball.y - BALL_R * 0.4,
      BALL_R * 0.1,
      state.ball.x,
      state.ball.y,
      BALL_R,
    )
    ballGrad.addColorStop(0, '#FFFFFF')
    ballGrad.addColorStop(1, '#CFD8DC')
    c.fillStyle = ballGrad
    c.beginPath()
    c.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // HUD
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.8
    c.beginPath()
    c.roundRect(190, 24, 340, 84, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#33691E'
    c.font = 'bold 44px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 74)
    c.fillStyle = '#7CA05F'
    c.font = '19px sans-serif'
    c.fillText(t('golf.hole', { a: state.holeIndex + 1, b: LEVELS.length, n: state.strokes }), 360, 100)

    if (sunkPopup) {
      c.globalAlpha = 1 - sunkPopup.age / 0.9
      c.fillStyle = '#FF6F00'
      c.font = 'bold 56px sans-serif'
      c.lineWidth = 8
      c.strokeStyle = '#FFFFFF'
      c.strokeText(sunkPopup.text, hx, hy - 110)
      c.fillText(sunkPopup.text, hx, hy - 110)
      c.globalAlpha = 1
    }

    // 텍스트 없는 조작 안내: 공에서 뒤로 당기는 표식
    if (state.holeIndex === 0 && state.strokes === 0 && state.phase === 'playing' && !state.aim) {
      const k = (state.playTime % 2) / 2
      const ease = k < 0.7 ? k / 0.7 : 1
      const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      const px2 = state.ball.x
      const py2 = state.ball.y + 130 * ease
      c.save()
      c.globalAlpha = 0.45 * fade
      c.strokeStyle = '#33691E'
      c.lineWidth = 3
      c.setLineDash([8, 10])
      c.beginPath()
      c.moveTo(state.ball.x, state.ball.y)
      c.lineTo(px2, py2)
      c.stroke()
      c.setLineDash([])
      c.globalAlpha = 0.65 * fade
      c.fillStyle = '#33691E'
      c.beginPath()
      c.arc(px2, py2, 16, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
