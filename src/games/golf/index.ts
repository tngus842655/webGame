import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
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
  let dragStart: { x: number; y: number } | null = null
  let sunkPopup: { text: string; age: number } | null = null

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '',
    onRetry() {
      if (state.phase !== 'over') return
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {},
  })

  async function courseComplete() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (destroyed || state.phase !== 'over') return
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
    const c = stage.begin('#FFE0B2', '#FFF8E1')
    const level = currentLevel(state)

    // 필드
    c.fillStyle = '#81C784'
    c.beginPath()
    c.roundRect(FIELD.left - 14, FIELD.top - 14, FIELD.right - FIELD.left + 28, FIELD.bottom - FIELD.top + 28, 24)
    c.fill()
    c.strokeStyle = '#5D4037'
    c.lineWidth = 8
    c.stroke()

    // 벽
    c.fillStyle = '#6D4C41'
    for (const wall of level.walls) {
      c.beginPath()
      c.roundRect(wall.x, wall.y, wall.w, wall.h, 8)
      c.fill()
    }

    // 홀 + 깃발
    const [hx, hy] = level.hole
    c.fillStyle = '#33691E'
    c.beginPath()
    c.arc(hx, hy, HOLE_R + 5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#1B1B1B'
    c.beginPath()
    c.arc(hx, hy, HOLE_R, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#ECEFF1'
    c.lineWidth = 4
    c.beginPath()
    c.moveTo(hx, hy - 6)
    c.lineTo(hx, hy - 60)
    c.stroke()
    c.fillStyle = '#E53935'
    c.beginPath()
    c.moveTo(hx, hy - 60)
    c.lineTo(hx + 34, hy - 48)
    c.lineTo(hx, hy - 36)
    c.closePath()
    c.fill()

    // 조준 점선
    if (state.aim && !state.moving) {
      c.fillStyle = '#FFF176'
      const dist = 120 + state.aim.power * 320
      for (let t = 30; t <= dist; t += 34) {
        c.beginPath()
        c.arc(state.ball.x + state.aim.dx * t, state.ball.y + state.aim.dy * t, 5, 0, Math.PI * 2)
        c.fill()
      }
    }

    // 공
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.15)'
    c.lineWidth = 2
    c.stroke()

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText(`홀 ${state.holeIndex + 1} / ${LEVELS.length} · 이번 홀 ${state.strokes}타`, 360, 52)
    c.fillStyle = '#5D4037'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 108)

    if (sunkPopup) {
      c.globalAlpha = 1 - sunkPopup.age / 0.9
      c.fillStyle = '#FF6F00'
      c.font = 'bold 56px sans-serif'
      c.fillText(sunkPopup.text, hx, hy - 80)
      c.globalAlpha = 1
    }

    if (state.holeIndex === 0 && state.strokes === 0 && state.phase === 'playing') {
      c.fillStyle = '#33691E'
      c.font = '26px sans-serif'
      c.fillText('당겨서 조준하고, 놓으면 발사!', 360, 1210)
      c.fillText('적은 타수로 넣을수록 점수가 높아요', 360, 1250)
    }
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

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
    if (sunkPopup) {
      sunkPopup.age += dt
      if (sunkPopup.age > 0.9) sunkPopup = null
    }
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

const golfGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default golfGame
