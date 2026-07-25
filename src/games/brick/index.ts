import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { BALL, BUTTON_RECTS, LAYOUT, UPGRADES, brickRect } from './config'
import { BrickRenderer } from './renderer'
import {
  advanceWave,
  clearDangerRows,
  createState,
  persistSave,
  tryPurchase,
  updateEffects,
} from './state'

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const renderer = new BrickRenderer(wrapper)
  const state = createState()
  let destroyed = false
  let adContinueUsed = false
  let aimingActive = false

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 이어하기 (3줄 제거)',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      // 골드·강화 레벨은 저장되어 유지된다 (RPG 루프)
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('brick_continue')
    if (destroyed || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    clearDangerRows(state)
    state.phase = 'aiming'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    persistSave(state.save)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const setAim = (px: number, py: number) => {
    const dx = px - state.launchX
    const dy = py - LAYOUT.launchY
    const len = Math.hypot(dx, dy)
    // 수평에 너무 가까운 각도는 무효 (무한 반사 방지)
    if (len < 10 || dy > -len * 0.15) {
      state.aim = null
      return
    }
    state.aim = { dx: dx / len, dy: dy / len }
  }

  const hitButton = (x: number, y: number): number => {
    for (let i = 0; i < BUTTON_RECTS.length; i++) {
      const r = BUTTON_RECTS[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i
    }
    return -1
  }

  const detachInput = attachInput(renderer.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'aiming') return
      const p = renderer.toBoard(clientX, clientY)
      const buttonIndex = hitButton(p.x, p.y)
      if (buttonIndex >= 0) {
        const def = UPGRADES[buttonIndex]
        if (tryPurchase(state, def)) {
          playMerge(3)
          const rect = BUTTON_RECTS[buttonIndex]
          state.popups.push({
            x: rect.x + rect.w / 2,
            y: rect.y - 10,
            text: `${def.label} UP!`,
            age: 0,
          })
        }
        return
      }
      aimingActive = true
      setAim(p.x, p.y)
    },
    onMove(clientX, clientY) {
      if (!aimingActive || state.phase !== 'aiming') return
      const p = renderer.toBoard(clientX, clientY)
      setAim(p.x, p.y)
    },
    onUp() {
      if (!aimingActive) return
      aimingActive = false
      if (state.phase !== 'aiming' || !state.aim) return
      state.toLaunch = state.save.ballLevel
      state.launchTimer = 0
      state.phase = 'flying'
      playDrop()
    },
  })

  const damageBrick = (index: number) => {
    const brick = state.bricks[index]
    brick.hp -= state.save.attackLevel
    if (brick.hp > 0) return
    state.bricks.splice(index, 1)
    state.save.gold += brick.maxHp
    state.score += brick.maxHp
    const r = brickRect(brick.col, brick.row)
    state.flashes.push({ x: r.x, y: r.y, w: r.w, h: r.h, age: 0 })
    state.popups.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, text: `+${brick.maxHp}`, age: 0 })
    playMerge(2)
    vibrate(10)
  }

  const collideBricks = (ball: { x: number; y: number; vx: number; vy: number }) => {
    for (let i = 0; i < state.bricks.length; i++) {
      const r = brickRect(state.bricks[i].col, state.bricks[i].row)
      const nx = Math.min(Math.max(ball.x, r.x), r.x + r.w)
      const ny = Math.min(Math.max(ball.y, r.y), r.y + r.h)
      const dx = ball.x - nx
      const dy = ball.y - ny
      if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
      } else {
        ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
      }
      damageBrick(i)
      break
    }
  }

  const moveBall = (ball: (typeof state.balls)[number], dt: number) => {
    let remaining = BALL.speed * dt
    while (remaining > 0 && ball.active) {
      const d = Math.min(14, remaining)
      remaining -= d
      const len = Math.hypot(ball.vx, ball.vy) || 1
      ball.x += (ball.vx / len) * d
      ball.y += (ball.vy / len) * d

      if (ball.x < LAYOUT.fieldLeft + BALL.radius) {
        ball.x = LAYOUT.fieldLeft + BALL.radius
        ball.vx = Math.abs(ball.vx)
      } else if (ball.x > LAYOUT.fieldRight - BALL.radius) {
        ball.x = LAYOUT.fieldRight - BALL.radius
        ball.vx = -Math.abs(ball.vx)
      }
      if (ball.y < LAYOUT.fieldTop + BALL.radius) {
        ball.y = LAYOUT.fieldTop + BALL.radius
        ball.vy = Math.abs(ball.vy)
      }
      if (ball.vy > 0 && ball.y >= LAYOUT.launchY) {
        ball.active = false
        if (state.firstLandedX === null) state.firstLandedX = ball.x
        break
      }
      collideBricks(ball)
    }
  }

  const update = (dt: number) => {
    if (state.phase !== 'flying') return

    if (state.toLaunch > 0 && state.aim) {
      state.launchTimer -= dt
      if (state.launchTimer <= 0) {
        state.launchTimer = BALL.launchInterval
        state.balls.push({
          x: state.launchX,
          y: LAYOUT.launchY,
          vx: state.aim.dx * BALL.speed,
          vy: state.aim.dy * BALL.speed,
          active: true,
        })
        state.toLaunch -= 1
      }
    }

    for (const ball of state.balls) {
      if (ball.active) moveBall(ball, dt)
    }

    // 턴 종료: 모든 공 착지
    if (state.toLaunch === 0 && state.balls.every((b) => !b.active)) {
      state.balls = []
      state.aim = null
      if (state.firstLandedX !== null) {
        state.launchX = Math.min(
          LAYOUT.fieldRight - BALL.radius,
          Math.max(LAYOUT.fieldLeft + BALL.radius, state.firstLandedX),
        )
      }
      state.firstLandedX = null
      persistSave(state.save)
      if (advanceWave(state)) {
        void gameOver()
      } else {
        state.phase = 'aiming'
      }
    }
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    update(dt)
    updateEffects(state, dt)
    renderer.draw(state)
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
      persistSave(state.save)
      renderer.destroy()
      wrapper.remove()
    },
  }
}

let session: Session | null = null

const brickGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default brickGame
