import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { LAYOUT } from './config'
import { attachInput } from './input'
import { BBRenderer, type DragState } from './renderer'
import {
  createState,
  dragTarget,
  pieceSize,
  placePiece,
  replaceTrayWithSmall,
  updateEffects,
} from './state'

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const renderer = new BBRenderer(wrapper)
  const state = createState()
  let destroyed = false
  let adSwapUsed = false
  let drag: DragState | null = null

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 블록 교체',
    onRetry() {
      if (state.phase !== 'over') return
      adSwapUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void swapWithAd()
    },
  })

  // 광고 보상: 남은 블록을 소형 블록으로 교체하고 이어하기 (판당 1회)
  async function swapWithAd() {
    if (state.phase !== 'over' || adSwapUsed) return
    const rewarded = await ctx.showRewardAd('blockblast_swap')
    if (destroyed || !rewarded || state.phase !== 'over') return
    adSwapUsed = true
    replaceTrayWithSmall(state)
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (destroyed || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adSwapUsed)
  }

  const hitTray = (x: number, y: number): number => {
    for (let i = 0; i < LAYOUT.traySlots.length; i++) {
      if (Math.abs(x - LAYOUT.traySlots[i]) <= 100 && Math.abs(y - LAYOUT.trayY) <= 100) return i
    }
    return -1
  }

  const detachInput = attachInput(renderer.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = renderer.toBoard(clientX, clientY)
      const i = hitTray(p.x, p.y)
      if (i >= 0 && state.tray[i]) drag = { trayIndex: i, x: p.x, y: p.y }
    },
    onMove(clientX, clientY) {
      if (!drag) return
      const p = renderer.toBoard(clientX, clientY)
      drag.x = p.x
      drag.y = p.y
    },
    onUp() {
      if (!drag) return
      const current = drag
      drag = null
      const piece = state.tray[current.trayIndex]
      if (!piece || state.phase !== 'playing') return
      const { col, row } = dragTarget(piece, current.x, current.y)
      const result = placePiece(state, current.trayIndex, col, row)
      if (!result) return

      playDrop()
      const { w, h } = pieceSize(piece)
      const cx = LAYOUT.boardX + (col + w / 2) * LAYOUT.cell
      const cy = LAYOUT.boardY + (row + h / 2) * LAYOUT.cell
      state.popups.push({ x: cx, y: cy - 20, text: `+${result.gained}`, age: 0 })
      if (result.linesCleared > 0) {
        playMerge(1 + result.linesCleared)
        vibrate(15)
        for (const cell of result.clearedCells) state.clearFx.push({ ...cell, age: 0 })
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
    renderer.draw(state, drag)
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

const blockBlastGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default blockBlastGame
