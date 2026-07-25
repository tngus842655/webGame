import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { F2Renderer } from './renderer'
import { createState, move, undo, updateEffects, type Direction } from './state'

const SWIPE_THRESHOLD = 40 // 보드 좌표 기준 최소 스와이프 거리

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const renderer = new F2Renderer(wrapper)
  const state = createState()
  let destroyed = false
  let adUndoUsed = false
  let swipeStart: { x: number; y: number } | null = null

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 한 수 되돌리기',
    onRetry() {
      if (state.phase !== 'over') return
      adUndoUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void undoWithAd()
    },
  })

  async function undoWithAd() {
    if (state.phase !== 'over' || adUndoUsed) return
    const rewarded = await ctx.showRewardAd('fruit2048_undo')
    if (destroyed || !rewarded || state.phase !== 'over') return
    if (undo(state)) {
      adUndoUsed = true
      overlay.hide()
    }
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adUndoUsed && state.prevGrid !== null,
    )
  }

  const detachInput = attachInput(renderer.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      swipeStart = renderer.toBoard(clientX, clientY)
    },
    onMove() {},
    onUp(clientX, clientY) {
      if (!swipeStart || state.phase !== 'playing') {
        swipeStart = null
        return
      }
      const p = renderer.toBoard(clientX, clientY)
      const dx = p.x - swipeStart.x
      const dy = p.y - swipeStart.y
      swipeStart = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return

      let dir: Direction
      if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
      else dir = dy > 0 ? 'down' : 'up'

      const result = move(state, dir)
      if (!result.moved) return
      playDrop()
      if (result.gained > 0) {
        playMerge(result.maxMergedTier)
        vibrate(10)
      }
      if (result.gameOver) void gameOver()
    },
  })

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
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
      renderer.destroy()
      wrapper.remove()
    },
  }
}

let session: Session | null = null

const fruit2048Game: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default fruit2048Game
