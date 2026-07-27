import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  CELL,
  COLS,
  ROWS,
  X0,
  Y0,
  addMoves,
  canUndo,
  createState,
  slide,
  undo,
  update,
  type Dir,
} from './state'
import { font } from '../ui'
import { drawIconValue } from '../icons'

const SWIPE_THRESHOLD = 40
const UNDO_BTN = { x: 196, y: 1112, w: 328, h: 88 } as const

const centerX = (cx: number) => X0 + cx * CELL + CELL / 2
const centerY = (cy: number) => Y0 + cy * CELL + CELL / 2

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.stars > 0) {
      playMerge(Math.min(6, 2 + events.stars))
      vibrate(12)
    }
    if (events.cleared) vibrate([20, 40, 30])
    else if (events.stopped) playDrop()
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let swipeStart: { x: number; y: number } | null = null
  let adMovesUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ic.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adMovesUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adMovesUsed) return
    const rewarded = await ctx.showRewardAd('iceslide-moves')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adMovesUsed = true
    addMoves(state, 5)
    overlay.hide()
  }

  // 공짜 되돌리기를 다 쓰면 광고로 한 번 더
  async function undoWithAd() {
    if (!canUndo(state)) return
    const rewarded = await ctx.showRewardAd('iceslide-undo')
    if (shell.isDestroyed() || !rewarded) return
    if (undo(state)) playDrop()
  }

  const tapUndo = () => {
    if (!canUndo(state)) return
    if (state.freeUndo > 0) {
      state.freeUndo -= 1
      if (undo(state)) playDrop()
      return
    }
    if (ctx.isRewardAdReady()) void undoWithAd()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adMovesUsed)
  }

  const trySwipe = (clientX: number, clientY: number) => {
    if (!swipeStart || state.phase !== 'playing') return
    const p = stage.toBoard(clientX, clientY)
    const dx = p.x - swipeStart.x
    const dy = p.y - swipeStart.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return
    swipeStart = null
    let dir: Dir
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
    else dir = dy > 0 ? 'down' : 'up'
    if (!slide(state, dir)) vibrate(30)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (
        p.x >= UNDO_BTN.x &&
        p.x <= UNDO_BTN.x + UNDO_BTN.w &&
        p.y >= UNDO_BTN.y &&
        p.y <= UNDO_BTN.y + UNDO_BTN.h
      ) {
        tapUndo()
        return
      }
      if (state.phase !== 'playing') return
      swipeStart = p
    },
    onMove: trySwipe,
    onUp(clientX, clientY) {
      trySwipe(clientX, clientY)
      swipeStart = null
    },
  })

  const drawStar = (cx: number, cy: number, r: number) => {
    const c = stage.c
    c.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 === 0 ? r : r * 0.44
      const x = cx + Math.cos(a) * rad
      const y = cy + Math.sin(a) * rad
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
    c.fillStyle = '#FFCA28'
    c.fill()
    c.strokeStyle = '#F9A825'
    c.lineWidth = 2
    c.stroke()
  }

  const drawPenguin = (x: number, y: number) => {
    const c = stage.c
    const [dx, dy] = state.facing === 'left' ? [-1, 0] : state.facing === 'right' ? [1, 0] : [0, state.facing === 'up' ? -0.6 : 0.6]
    c.fillStyle = '#263238'
    c.beginPath()
    c.arc(x, y, 31, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.ellipse(x + dx * 6, y + dy * 5 + 4, 18, 21, 0, 0, Math.PI * 2)
    c.fill()
    // 부리는 보는 쪽으로
    c.fillStyle = '#FB8C00'
    c.beginPath()
    c.moveTo(x + dx * 30, y + dy * 26)
    c.lineTo(x + dx * 14 - dy * 9, y + dy * 14 - dx * 9)
    c.lineTo(x + dx * 14 + dy * 9, y + dy * 14 + dx * 9)
    c.closePath()
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(x - 9, y - 12, 6.5, 0, Math.PI * 2)
    c.arc(x + 9, y - 12, 6.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#0D1B22'
    c.beginPath()
    c.arc(x - 9 + dx * 2, y - 12 + dy * 2, 3.2, 0, Math.PI * 2)
    c.arc(x + 9 + dx * 2, y - 12 + dy * 2, 3.2, 0, Math.PI * 2)
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#0B2A3A', '#123C51')

    // 얼음판
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = X0 + x * CELL
        const py = Y0 + y * CELL
        c.fillStyle = (x + y) % 2 === 0 ? '#D9EEF7' : '#CBE6F2'
        c.fillRect(px, py, CELL, CELL)
        c.strokeStyle = 'rgb(255 255 255 / 0.55)'
        c.lineWidth = 1
        c.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1)
      }
    }

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x
        const px = X0 + x * CELL
        const py = Y0 + y * CELL
        if (state.rocks[i]) {
          c.fillStyle = '#607D8B'
          c.beginPath()
          c.roundRect(px + 7, py + 9, CELL - 14, CELL - 16, 12)
          c.fill()
          c.fillStyle = '#90A4AE'
          c.beginPath()
          c.roundRect(px + 13, py + 14, CELL - 26, 12, 6)
          c.fill()
        } else if (state.stars[i]) {
          drawStar(px + CELL / 2, py + CELL / 2, 26)
        }
      }
    }

    // 펭귄 — 미끄러지는 동안은 칸 사이를 보간해 그린다
    let pxPos = centerX(state.px)
    let pyPos = centerY(state.py)
    const sl = state.slide
    if (sl) {
      const e = 1 - (1 - sl.t) * (1 - sl.t)
      pxPos = centerX(sl.fromX) + (centerX(sl.toX) - centerX(sl.fromX)) * e
      pyPos = centerY(sl.fromY) + (centerY(sl.toY) - centerY(sl.fromY)) * e
    }
    drawPenguin(pxPos, pyPos)

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#FFFFFF'
    c.font = font(44, true)
    c.fillText(state.score.toLocaleString(), 360, 66)
    c.font = font(22)
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('ic.level', { n: state.level }), 360, 104)

    // 남은 이동이 곧 수명이라 크게 보여 준다
    c.textAlign = 'left'
    c.fillStyle = state.moves <= 3 ? '#FF8A65' : '#FFFFFF'
    c.font = font(30, true)
    c.fillText(t('ic.moves', { n: state.moves }), 30, 200)
    c.fillStyle = '#FFCA28'
    drawIconValue(c, 'star', String(state.starsLeft), 690, 190, 15, 'right')
    c.textAlign = 'center'

    if (state.level === 1 && state.history.length === 0) {
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = font(22)
      c.fillText(t('ic.hint'), 360, 148)
    }

    // 되돌리기 버튼 (공짜가 남았으면 회색, 다 쓰면 광고 버튼)
    const undoReady = canUndo(state)
    const useAd = state.freeUndo === 0
    if (undoReady && (!useAd || ctx.isRewardAdReady())) {
      c.fillStyle = useAd ? '#43A047' : 'rgb(255 255 255 / 0.16)'
      c.beginPath()
      c.roundRect(UNDO_BTN.x, UNDO_BTN.y, UNDO_BTN.w, UNDO_BTN.h, 22)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(25, true)
      c.textBaseline = 'middle'
      c.fillText(
        useAd ? t('ic.undoAd') : t('ic.undo', { n: state.freeUndo }),
        UNDO_BTN.x + UNDO_BTN.w / 2,
        UNDO_BTN.y + UNDO_BTN.h / 2 + 1,
      )
      c.textBaseline = 'alphabetic'
    }

    if (state.clearFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, state.clearFlash / 0.4)
      c.fillStyle = 'rgb(0 0 0 / 0.6)'
      c.fillRect(0, 600, 720, 120)
      c.fillStyle = '#FFD54F'
      c.font = font(40, true)
      c.fillText(t('ic.clear', { n: state.clearGain }), 360, 676)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
