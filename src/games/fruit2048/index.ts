import { playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { F2Renderer } from './renderer'
import { createState, move, undo, updateEffects, type Direction } from './state'

const SWIPE_THRESHOLD = 40 // 보드 좌표 기준 최소 스와이프 거리

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    updateEffects(state, dt)
    renderer.draw(state)
  })
  const renderer = new F2Renderer(shell.wrapper)
  const state = createState()
  preloadSfx('gameover', 'merge', 'whoosh')
  let adUndoUsed = false
  let swipeStart: { x: number; y: number } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'f2.ad',
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
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    if (undo(state)) {
      adUndoUsed = true
      overlay.hide()
    }
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adUndoUsed && state.prevGrid !== null,
    )
  }

  // 손가락이 임계값을 넘는 즉시 옮긴다. 뗄 때까지 기다리면 연속 스와이프가
  // 굼떠서, 빠르게 밀어붙이는 맛이 사는 이 장르에서 특히 답답하다.
  const trySwipe = (clientX: number, clientY: number) => {
    if (!swipeStart || state.phase !== 'playing') return
    const p = renderer.toBoard(clientX, clientY)
    const dx = p.x - swipeStart.x
    const dy = p.y - swipeStart.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return
    // 한 번 눌렀다 뗄 때마다 한 수 — 끌고 다닌다고 연달아 움직이지는 않는다
    swipeStart = null

    let dir: Direction
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
    else dir = dy > 0 ? 'down' : 'up'

    const result = move(state, dir)
    if (!result.moved) return
    playSfx('whoosh')
    if (result.gained > 0) {
      playMerge(result.maxMergedTier)
      vibrate(10)
    }
    if (result.gameOver) void gameOver()
  }

  const detachInput = attachInput(renderer.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      swipeStart = renderer.toBoard(clientX, clientY)
    },
    onMove: trySwipe,
    onUp(clientX, clientY) {
      trySwipe(clientX, clientY)
      swipeStart = null
    },
  })

  shell.addCleanup(detachInput)
  shell.addCleanup(() => renderer.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
