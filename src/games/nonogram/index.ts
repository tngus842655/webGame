import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  applyFill,
  createState,
  loadPuzzle,
  puzzlePoints,
  toggleMark,
  type CellState,
  type Mode,
} from './state'

// 화면 배치 (논리 720×1280): 좌측·상단 힌트 영역 ~170px, 그리드는 정사각
const GRID_X = 190
const GRID_Y = 370
const GRID_W = 510
const BTN = { y: 1040, h: 150, w: 290, x1: 50, x2: 380 } as const

// 하트 그리기 (cx, cy 중심, s = 반너비)
function drawHeart(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  on: boolean,
  alpha = 1,
) {
  c.save()
  c.globalAlpha = alpha
  c.fillStyle = on ? '#E53935' : '#CDD3EA'
  const top = cy - s * 0.75
  c.beginPath()
  c.moveTo(cx, top + s * 0.45)
  c.bezierCurveTo(cx, top, cx - s, top, cx - s, top + s * 0.45)
  c.bezierCurveTo(cx - s, top + s * 0.95, cx, top + s * 1.25, cx, top + s * 1.55)
  c.bezierCurveTo(cx, top + s * 1.25, cx + s, top + s * 0.95, cx + s, top + s * 0.45)
  c.bezierCurveTo(cx + s, top, cx, top, cx, top + s * 0.45)
  c.fill()
  c.restore()
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    state.shakeTime = Math.max(0, state.shakeTime - dt)
    if (state.phase === 'clearing') {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) {
        loadPuzzle(state, state.level + 1)
        state.phase = 'playing'
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    if (popup) {
      popup.age += dt
      if (popup.age > 1) popup = null
    }
    if (lostHeart) {
      lostHeart.age += dt
      if (lostHeart.age > 0.6) lostHeart = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let drag: { mode: Mode; markValue: CellState; last: number } | null = null
  let popup: { text: string; age: number } | null = null
  let lostHeart: { index: number; age: number } | null = null
  let adContinueUsed = false
  const bonus = createClearBonus(shell, ctx, 'nonogram-clear')

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'no.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 생명 1개를 받고 같은 퍼즐을 이어서 푼다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('nonogram-life')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.lives = 1
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const cellAt = (x: number, y: number) => {
    const cell = GRID_W / state.size
    const col = Math.floor((x - GRID_X) / cell)
    const row = Math.floor((y - GRID_Y) / cell)
    if (row < 0 || col < 0 || row >= state.size || col >= state.size) return null
    return { row, col }
  }

  const tryFill = (row: number, col: number) => {
    const result = applyFill(state, row, col)
    if (result === 'filled') {
      playMerge(3)
      if (state.remaining === 0) void onPuzzleClear()
    } else if (result === 'miss') {
      drag = null // 오답이면 드래그 종료
      vibrate(60)
      state.shakeTime = 0.35
      state.lives -= 1
      lostHeart = { index: state.lives, age: 0 }
      if (state.lives <= 0) {
        state.phase = 'over'
        state.overTimer = 0.9
      }
    }
  }

  const onPuzzleClear = async () => {
    let points = puzzlePoints(state.size) + state.lives * 100
    playMerge(6)
    vibrate(30)
    state.phase = 'clearing'
    state.clearTimer = 1.4
    // 보너스를 묻는 동안 셸이 멈추므로 다음 퍼즐로 넘어가지 않는다
    if (await bonus.offer(points)) points *= 2
    if (shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
    popup = { text: `+${points}`, age: 0 }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 하단 모드 토글 버튼
      if (p.y >= BTN.y && p.y <= BTN.y + BTN.h) {
        if (p.x >= BTN.x1 && p.x <= BTN.x1 + BTN.w) {
          state.mode = 'fill'
          playDrop()
        } else if (p.x >= BTN.x2 && p.x <= BTN.x2 + BTN.w) {
          state.mode = 'mark'
          playDrop()
        }
        return
      }
      const hit = cellAt(p.x, p.y)
      if (!hit) return
      if (state.mode === 'fill') {
        drag = { mode: 'fill', markValue: 0, last: hit.row * state.size + hit.col }
        tryFill(hit.row, hit.col)
      } else {
        const applied = toggleMark(state, hit.row, hit.col)
        if (applied === null) return
        playDrop()
        drag = { mode: 'mark', markValue: applied, last: hit.row * state.size + hit.col }
      }
    },
    onMove(clientX, clientY) {
      if (!drag || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      const hit = cellAt(p.x, p.y)
      if (!hit) return
      const key = hit.row * state.size + hit.col
      if (key === drag.last) return
      drag.last = key
      if (drag.mode === 'fill') {
        tryFill(hit.row, hit.col)
      } else {
        // 첫 셀과 같은 방향(표시/해제)으로만 연속 적용
        const cur = state.cells[hit.row][hit.col]
        if (drag.markValue === 2 ? cur === 0 : cur === 2) {
          toggleMark(state, hit.row, hit.col)
          playDrop()
        }
      }
    },
    onUp() {
      drag = null
    },
  })

  const draw = () => {
    const c = stage.begin('#5C6BC0', '#E8EAF6')
    const size = state.size
    const cell = GRID_W / size
    const clearing = state.phase === 'clearing'

    // HUD: 흰 카드 + 점수 + 퍼즐 번호 + 하트
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.92
    c.beginPath()
    c.roundRect(160, 24, 400, 150, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#9FA8DA'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 56)
    c.fillStyle = '#283593'
    c.font = 'bold 50px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 110)
    c.fillStyle = '#5C6BC0'
    c.font = '24px sans-serif'
    c.textAlign = 'left'
    c.fillText(t('no.puzzle', { n: state.level }), 196, 152)
    c.textAlign = 'center'
    const heartX = (i: number) => 428 + i * 46
    for (let i = 0; i < 3; i++) drawHeart(c, heartX(i), 142, 16, i < state.lives)
    if (lostHeart) {
      const k = lostHeart.age / 0.6
      drawHeart(c, heartX(lostHeart.index), 142 - k * 28, 16, true, 1 - k)
    }

    // 그리드 (오답 시 좌우 흔들림)
    c.save()
    if (state.shakeTime > 0) {
      c.translate(Math.sin(state.playTime * 70) * 8 * (state.shakeTime / 0.35), 0)
    }
    c.fillStyle = '#FFFFFF'
    c.fillRect(GRID_X, GRID_Y, GRID_W, GRID_W)

    // 셀: 칠함 / X 표시 (완성 연출 중에는 그림만 남긴다)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const st = state.cells[row][col]
        const x = GRID_X + col * cell
        const y = GRID_Y + row * cell
        if (st === 1) {
          c.fillStyle = '#303F9F'
          c.beginPath()
          c.roundRect(x + 2, y + 2, cell - 4, cell - 4, clearing ? cell * 0.18 : 4)
          c.fill()
        } else if (st === 2 && !clearing) {
          c.strokeStyle = '#B0BEC5'
          c.lineWidth = 4
          c.lineCap = 'round'
          const m = cell * 0.28
          c.beginPath()
          c.moveTo(x + m, y + m)
          c.lineTo(x + cell - m, y + cell - m)
          c.moveTo(x + cell - m, y + m)
          c.lineTo(x + m, y + cell - m)
          c.stroke()
        }
      }
    }

    if (!clearing) {
      // 격자선: 5셀마다 굵은 구분선
      for (let i = 0; i <= size; i++) {
        const bold = i % 5 === 0 || i === size
        c.strokeStyle = bold ? '#5C6BC0' : '#C5CAE9'
        c.lineWidth = bold ? 3 : 1
        c.beginPath()
        c.moveTo(GRID_X + i * cell, GRID_Y)
        c.lineTo(GRID_X + i * cell, GRID_Y + GRID_W)
        c.moveTo(GRID_X, GRID_Y + i * cell)
        c.lineTo(GRID_X + GRID_W, GRID_Y + i * cell)
        c.stroke()
      }

      // 힌트 숫자 (완성한 줄은 회색 처리)
      const font = size === 5 ? 40 : size === 8 ? 32 : 27
      const gap = font + 6
      c.font = `bold ${font}px sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      for (let col = 0; col < size; col++) {
        const hints = state.colHints[col]
        c.fillStyle = state.colDone[col] ? '#B4BAD9' : '#1A237E'
        const cx = GRID_X + col * cell + cell / 2
        hints.forEach((n, i) => {
          c.fillText(String(n), cx, GRID_Y - 10 - gap / 2 - (hints.length - 1 - i) * gap)
        })
      }
      for (let row = 0; row < size; row++) {
        const hints = state.rowHints[row]
        c.fillStyle = state.rowDone[row] ? '#B4BAD9' : '#1A237E'
        const cy = GRID_Y + row * cell + cell / 2
        hints.forEach((n, i) => {
          c.fillText(String(n), GRID_X - 10 - gap / 2 - (hints.length - 1 - i) * gap, cy)
        })
      }
      c.textBaseline = 'alphabetic'
    }
    c.restore()

    // 점수 팝업
    if (popup) {
      c.save()
      c.globalAlpha = 1 - popup.age
      c.font = 'bold 64px sans-serif'
      c.textAlign = 'center'
      c.lineWidth = 8
      c.strokeStyle = '#FFFFFF'
      c.fillStyle = '#FF6F00'
      c.strokeText(popup.text, GRID_X + GRID_W / 2, GRID_Y + GRID_W / 2 - popup.age * 50)
      c.fillText(popup.text, GRID_X + GRID_W / 2, GRID_Y + GRID_W / 2 - popup.age * 50)
      c.restore()
    }

    // 하단 모드 토글 버튼
    const drawButton = (x: number, label: string, active: boolean) => {
      c.save()
      c.fillStyle = active ? '#3949AB' : '#FFFFFF'
      c.strokeStyle = '#3949AB'
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(x, BTN.y, BTN.w, BTN.h, 28)
      c.fill()
      c.stroke()
      c.fillStyle = active ? '#FFFFFF' : '#3949AB'
      c.font = 'bold 40px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(label, x + BTN.w / 2, BTN.y + BTN.h / 2)
      c.restore()
    }
    drawButton(BTN.x1, t('no.fill'), state.mode === 'fill')
    drawButton(BTN.x2, t('no.mark'), state.mode === 'mark')
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
