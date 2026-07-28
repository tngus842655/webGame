import { playDrop, playGameOver, playMerge, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { createGameShell, defineGame } from '../shell'
import { BOARD, RULES, TIERS } from './config'
import { attachInput } from './input'
import { SuikaRenderer } from './renderer'
import { createState, pickDropTier, updateEffects } from './state'
import { SuikaWorld } from './world'

const STEP_MS = 1000 / 60

// 부활 시 걷어낼 과일의 상한 티어 (0=체리 … 3=오렌지)
const REVIVE_MAX_TIER = 3

function createSession(host: HTMLElement, ctx: GameContext) {
  let acc = 0
  const shell = createGameShell(host, (dt) => {
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
  })
  const renderer = new SuikaRenderer(shell.wrapper)
  const world = new SuikaWorld()
  const state = createState()
  preloadSfx('gameover', 'merge', 'tap')

  world.onMerge = (e) => {
    state.score += e.gained
    state.maxTier = Math.max(state.maxTier, e.spawnedTier ?? TIERS.length - 1)
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

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'suika.ad',
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

  // 광고 보상: 작은 과일(체리~오렌지)만 걷어내 자리를 만들고 이어하기 (판당 1회).
  // 키워둔 큰 과일은 남으므로 하던 판을 그대로 잇는다.
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('suika_continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    // 작은 과일이 하나도 없으면(큰 것만 남아 넘친 경우) 한 단계 위까지 걷어낸다
    if (world.clearSmallFruits(REVIVE_MAX_TIER) === 0) world.clearSmallFruits(REVIVE_MAX_TIER + 2)
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
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => world.destroy())
  shell.addCleanup(() => renderer.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
