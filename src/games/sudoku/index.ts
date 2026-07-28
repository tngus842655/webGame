import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  clearPoints,
  createState,
  loadPractice,
  placeDigit,
  recordDailyClear,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIcon } from '../icons'

// 화면 배치 (논리 720×1280)
const GRID_X = 36
const GRID_Y = 240
const CELL = 72
const GRID_W = CELL * 9
const PAD = { y: 952, h: 116, w: 68, gap: 4, x: 38 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    state.shakeTime = Math.max(0, state.shakeTime - dt)
    if (state.phase === 'playing') state.elapsed += dt
    if (state.phase === 'clearing') {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) {
        loadPractice(state, state.level + 1)
        state.phase = 'playing'
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    if (popup) {
      popup.age += dt
      if (popup.age > 1.2) popup = null
    }
    if (lostHeart) {
      lostHeart.age += dt
      if (lostHeart.age > 0.6) lostHeart = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'gameover', 'select', 'tap')
  let popup: { text: string; age: number } | null = null
  let lostHeart: { index: number; age: number } | null = null
  let adContinueUsed = false
  const bonus = createClearBonus(shell, ctx, 'sudoku-clear')

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'sd.ad',
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
    const rewarded = await ctx.showRewardAd('sudoku-life')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.lives = 1
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const onPuzzleClear = async () => {
    let points = clearPoints(state)
    // 스트릭은 출석 표시일 뿐 점수에는 넣지 않는다 —
    // 지난 날들의 기록이 오늘 점수에 얹히면 순위표가 실력을 재지 못한다
    if (state.daily) state.streak = recordDailyClear().streak
    playSfx('clear')
    vibrate(30)
    state.phase = 'clearing'
    state.clearTimer = 1.6
    // 보너스를 묻는 동안 셸이 멈추므로 다음 퍼즐로 넘어가지 않는다
    if (await bonus.offer(points)) points *= 2
    if (shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
    popup = { text: `+${points}`, age: 0 }
  }

  const tryPlace = (digit: number) => {
    const result = placeDigit(state, digit)
    if (result === 'placed') {
      playSfx('select')
      if (state.remaining === 0) void onPuzzleClear()
    } else if (result === 'miss') {
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

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 숫자 패드
      if (p.y >= PAD.y && p.y <= PAD.y + PAD.h) {
        const idx = Math.floor((p.x - PAD.x) / (PAD.w + PAD.gap))
        if (idx >= 0 && idx < 9) tryPlace(idx + 1)
        return
      }
      // 보드 셀 선택 (채워진 칸도 같은 숫자 강조를 위해 선택 가능)
      const col = Math.floor((p.x - GRID_X) / CELL)
      const row = Math.floor((p.y - GRID_Y) / CELL)
      if (row >= 0 && col >= 0 && row < 9 && col < 9) {
        state.selected = row * 9 + col
        playDrop()
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#00796B', '#E0F2F1')
    const clearing = state.phase === 'clearing'
    const sel = state.selected
    const selDigit = sel >= 0 ? state.cells[sel] : 0

    // HUD 카드: 점수 + 퍼즐 종류 + 하트
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.94)',
      labelColor: '#80CBC4',
      valueColor: '#004D40',
    })
    c.fillStyle = '#00796B'
    c.font = font(24)
    c.textAlign = 'left'
    const now = new Date()
    c.fillText(
      state.daily
        ? t('sd.daily', { date: `${now.getMonth() + 1}/${now.getDate()}` })
        : t('sd.practice', { n: state.level }),
      SCORE_PANEL.left,
      SCORE_PANEL.subY,
    )
    c.textAlign = 'center'
    const heartX = (i: number) => 462 + i * 42
    for (let i = 0; i < 3; i++) {
      drawIcon(c, 'heart', heartX(i), SCORE_PANEL.subY - 8, 14, { dim: i >= state.lives })
    }
    if (lostHeart) {
      const k = lostHeart.age / 0.6
      drawIcon(c, 'heart', heartX(lostHeart.index), SCORE_PANEL.subY - 8 - k * 28, 14, {
        alpha: 1 - k,
      })
    }

    // 스트릭·경과 시간
    c.fillStyle = '#FFFFFF'
    c.font = font(26, true)
    c.textAlign = 'left'
    c.fillText(t('sd.streak', { n: state.streak }), GRID_X + 4, 216)
    const mm = Math.floor(state.elapsed / 60)
    const ss = String(Math.floor(state.elapsed % 60)).padStart(2, '0')
    c.textAlign = 'right'
    c.fillText(`${mm}:${ss}`, GRID_X + GRID_W - 4, 216)
    c.textAlign = 'center'

    // 보드 (오답 시 좌우 흔들림)
    c.save()
    if (state.shakeTime > 0) {
      c.translate(Math.sin(state.playTime * 70) * 8 * (state.shakeTime / 0.35), 0)
    }
    c.fillStyle = '#FFFFFF'
    c.fillRect(GRID_X, GRID_Y, GRID_W, GRID_W)

    // 선택 강조: 같은 행/열/박스 + 같은 숫자
    if (!clearing && sel >= 0) {
      const sr = Math.floor(sel / 9)
      const sc = sel % 9
      for (let i = 0; i < 81; i++) {
        const r = Math.floor(i / 9)
        const col = i % 9
        const sameLine =
          r === sr ||
          col === sc ||
          (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(col / 3) === Math.floor(sc / 3))
        const sameDigit = selDigit !== 0 && state.cells[i] === selDigit
        if (i === sel) {
          c.fillStyle = '#B2DFDB'
        } else if (sameDigit) {
          c.fillStyle = '#80CBC4'
        } else if (sameLine) {
          c.fillStyle = '#E6F3F1'
        } else {
          continue
        }
        c.fillRect(GRID_X + col * CELL, GRID_Y + r * CELL, CELL, CELL)
      }
    }

    // 숫자
    c.font = font(44, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    for (let i = 0; i < 81; i++) {
      const d = state.cells[i]
      if (d === 0) continue
      const r = Math.floor(i / 9)
      const col = i % 9
      c.fillStyle = clearing ? '#00897B' : state.givens[i] ? '#263238' : '#00897B'
      c.fillText(String(d), GRID_X + col * CELL + CELL / 2, GRID_Y + r * CELL + CELL / 2 + 2)
    }
    c.textBaseline = 'alphabetic'

    // 격자선: 3칸마다 굵은 구분선
    for (let i = 0; i <= 9; i++) {
      const bold = i % 3 === 0
      c.strokeStyle = bold ? '#37474F' : '#B0BEC5'
      c.lineWidth = bold ? 4 : 1
      c.beginPath()
      c.moveTo(GRID_X + i * CELL, GRID_Y)
      c.lineTo(GRID_X + i * CELL, GRID_Y + GRID_W)
      c.moveTo(GRID_X, GRID_Y + i * CELL)
      c.lineTo(GRID_X + GRID_W, GRID_Y + i * CELL)
      c.stroke()
    }
    c.restore()

    // 점수 팝업
    if (popup) {
      c.save()
      c.globalAlpha = Math.min(1, 1.2 - popup.age)
      c.font = font(64, true)
      c.textAlign = 'center'
      c.lineWidth = 8
      c.strokeStyle = '#FFFFFF'
      c.fillStyle = '#FF6F00'
      const py = GRID_Y + GRID_W / 2 - popup.age * 50
      c.strokeText(popup.text, GRID_X + GRID_W / 2, py)
      c.fillText(popup.text, GRID_X + GRID_W / 2, py)
      c.restore()
    }

    // 숫자 패드 (남은 개수 표기, 다 쓴 숫자는 흐리게)
    for (let d = 1; d <= 9; d++) {
      const x = PAD.x + (d - 1) * (PAD.w + PAD.gap)
      const left = state.counts[d]
      c.save()
      c.globalAlpha = left > 0 ? 1 : 0.35
      c.fillStyle = '#FFFFFF'
      c.strokeStyle = '#00796B'
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(x, PAD.y, PAD.w, PAD.h, 16)
      c.fill()
      c.stroke()
      c.fillStyle = '#00695C'
      c.font = font(44, true)
      c.textAlign = 'center'
      c.fillText(String(d), x + PAD.w / 2, PAD.y + 58)
      c.fillStyle = '#80CBC4'
      c.font = font(22, true)
      c.fillText(String(left), x + PAD.w / 2, PAD.y + 94)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
