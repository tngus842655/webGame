import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { BOARD, RULES, TIERS } from './config'
import { attachInput } from './input'
import { SuikaRenderer } from './renderer'
import { createState, pickDropTier, updateEffects } from './state'
import { SuikaWorld } from './world'

const STEP_MS = 1000 / 60

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const renderer = new SuikaRenderer(wrapper)
  const world = new SuikaWorld()
  const state = createState()
  let destroyed = false

  world.onMerge = (e) => {
    state.score += e.gained
    const popRadius = TIERS[e.spawnedTier ?? TIERS.length - 1].radius
    state.pops.push({ x: e.x, y: e.y, r: popRadius, age: 0 })
    state.popups.push({ x: e.x, y: e.y - 40, text: `+${e.gained}`, age: 0 })
    const color = TIERS[e.tier].color
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5
      const speed = 250 + Math.random() * 200
      state.sparks.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150,
        age: 0,
        color,
      })
    }
    playMerge(e.tier)
    vibrate(15)
  }

  let adContinueUsed = false

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 이어하기 (통 비우기)',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      world.reset()
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 통을 비우고 점수를 유지한 채 이어하기 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('suika_continue')
    if (destroyed || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    world.reset()
    state.phase = 'playing'
    state.dangerTime = 0
    state.cooldown = 0
    overlay.hide()
  }

  const clampAim = (x: number) => {
    const r = TIERS[state.currentTier].radius
    return Math.min(BOARD.wallRight - 7 - r, Math.max(BOARD.wallLeft + 7 + r, x))
  }

  const detachInput = attachInput(renderer.canvas, {
    onAim(clientX, clientY) {
      if (state.phase !== 'playing') return
      state.aimX = clampAim(renderer.toBoard(clientX, clientY).x)
    },
    onRelease(clientX) {
      if (state.phase !== 'playing' || state.cooldown > 0) return
      const x = clampAim(renderer.toBoard(clientX, 0).x)
      world.addFruit(state.currentTier, x, BOARD.dropY)
      playDrop()
      state.currentTier = state.nextTier
      state.nextTier = pickDropTier()
      state.aimX = clampAim(x)
      state.cooldown = RULES.dropCooldown
    },
  })

  const checkDanger = (dt: number) => {
    let danger = false
    for (const { body, tier } of world.fruitBodies()) {
      const top = body.position.y - TIERS[tier].radius
      if (top < BOARD.dangerY && body.speed < RULES.settleSpeed) {
        danger = true
        break
      }
    }
    state.dangerTime = danger ? state.dangerTime + dt : 0
    if (state.dangerTime >= RULES.gameOverSeconds) void gameOver()
  }

  async function gameOver() {
    state.phase = 'over'
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  let rafId = 0
  let last = performance.now()
  let acc = 0

  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    if (state.phase === 'playing') {
      acc += dt * 1000
      let steps = 0
      while (acc >= STEP_MS && steps < 3) {
        world.step(STEP_MS)
        acc -= STEP_MS
        steps += 1
      }
      if (steps === 3) acc = 0 // 프레임 드랍 시 물리 스텝 누적 방지
      state.cooldown = Math.max(0, state.cooldown - dt)
      checkDanger(dt)
    }
    updateEffects(state, dt)
    renderer.draw(state, world)
  }

  // 백그라운드 전환 시 물리·렌더 일시정지 (DESIGN.md 7.6)
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
      world.destroy()
      renderer.destroy()
      wrapper.remove()
    },
  }
}

let session: Session | null = null

const suikaGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default suikaGame
