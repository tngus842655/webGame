import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { LAYOUT } from './config'
import { BBRenderer, type DragState } from './renderer'
import {
  createState,
  dragTarget,
  pieceSize,
  placePiece,
  replaceTrayWithSmall,
  updateEffects,
} from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    updateEffects(state, dt)
    renderer.draw(state, drag)
  })
  const renderer = new BBRenderer(shell.wrapper)
  const state = createState()
  preloadSfx('gameover', 'pop', 'select', 'clear')
  let adSwapUsed = false
  let drag: DragState | null = null

  function newGame() {
    adSwapUsed = false
    drag = null
    Object.assign(state, createState())
  }

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'bb.ad',
    onRetry() {
      if (state.phase !== 'over') return
      newGame()
      overlay.hide()
    },
    onContinue() {
      void swapWithAd()
    },
  })

  // 광고 보상: 남은 블록을 소형 블록으로 교체하고 이어하기 (판당 1회)
  async function swapWithAd() {
    if (state.phase !== 'over' || adSwapUsed) return
    const rewarded = await ctx.showRewardAd('blockblast-swap')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adSwapUsed = true
    replaceTrayWithSmall(state)
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    // 못 놓는 조각에 ×가 얹힌 화면을 잠깐 보여주고 팝업을 연다 — 왜 죽었는지 눈에 남게
    await new Promise((resolve) => setTimeout(resolve, 900))
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adSwapUsed, 'over.byStuck')
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

      playSfx('select')
      const { w, h } = pieceSize(piece)
      const cx = LAYOUT.boardX + (col + w / 2) * LAYOUT.cell
      const cy = LAYOUT.boardY + (row + h / 2) * LAYOUT.cell
      state.popups.push({ x: cx, y: cy - 20, text: `+${result.gained}`, age: 0 })
      if (result.linesCleared > 0) {
        playSfx('pop', { rate: 1 + Math.min(3, result.linesCleared - 1) * 0.12 })
        vibrate(15)
        for (const cell of result.clearedCells) state.clearFx.push({ ...cell, age: 0 })
      }
      if (result.allClear) {
        playSfx('clear')
        vibrate(40)
        state.popups.push({
          x: LAYOUT.width / 2,
          y: LAYOUT.boardY + 220,
          text: t('bb.allClear'),
          age: 0,
        })
      }
      if (result.gameOver) void gameOver()
    },
  })

  shell.addCleanup(detachInput)
  shell.addCleanup(() => renderer.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
