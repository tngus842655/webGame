import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  applyAiMove,
  createState,
  playerMove,
  startStage,
  tickClock,
  undo,
  MAX_STAGE,
  SIZE,
  TIMED_FROM,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconValue } from '../icons'

// 화면 배치 (논리 720×1280): 교차점 방식 바둑판
const CELL = 44
const BOARD_W = CELL * (SIZE - 1)
const X0 = (720 - BOARD_W) / 2
const Y0 = 300
const UNDO_BTN = { x: 180, y: 1010, w: 360, h: 92 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.thinkTimer -= dt
    // 제한 시간이 붙는 단(6단~)에서 내 차례일 때만 시계가 간다
    if (state.phase === 'playing' && tickClock(state, dt)) {
      state.phase = 'lost'
      state.resultTimer = 2
      vibrate(80)
      playGameOver()
    }
    if (state.phase === 'aiThinking' && state.thinkTimer <= 0) {
      const result = applyAiMove(state)
      playDrop()
      if (result === 'win') {
        vibrate(80)
        playGameOver()
      }
    }
    if ((state.phase === 'won' || state.phase === 'lost') && state.resultTimer > 0) {
      state.resultTimer -= dt
      if (state.resultTimer <= 0) {
        if (state.phase === 'won' && !state.cleared) {
          startStage(state, state.stage + 1)
          undoUsed = false
        } else {
          // 패배 또는 10단 통과 — 어느 쪽이든 판이 끝난다
          state.phase = 'over'
          void gameOver()
        }
      }
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let undoUsed = false // 판당 1회 광고 무르기
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'om.ad',
    onRetry() {
      if (state.phase !== 'over') return
      Object.assign(state, createState())
      undoUsed = false
      adContinueUsed = false
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 진 단을 새 판으로 한 번 더 도전한다 (한 판당 1회).
  // 시간 초과로 졌을 수도 있어 무르기가 아니라 판을 새로 깐다.
  async function continueWithAd() {
    if (state.phase !== 'over' || state.cleared || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('omok-continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    startStage(state, state.stage)
    undoUsed = false
    overlay.hide()
  }

  async function gameOver() {
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed && !state.cleared)
  }

  // 광고 보상: 마지막 한 수 무르기
  async function undoWithAd() {
    if (state.phase !== 'playing' || undoUsed || state.history.length < 2) return
    const rewarded = await ctx.showRewardAd('omok-undo')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'playing') return
    if (undo(state)) {
      undoUsed = true
      playMerge(3)
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (
        state.phase === 'playing' &&
        p.x >= UNDO_BTN.x &&
        p.x <= UNDO_BTN.x + UNDO_BTN.w &&
        p.y >= UNDO_BTN.y &&
        p.y <= UNDO_BTN.y + UNDO_BTN.h
      ) {
        void undoWithAd()
        return
      }
      if (state.phase !== 'playing') return
      const col = Math.round((p.x - X0) / CELL)
      const row = Math.round((p.y - Y0) / CELL)
      if (col < 0 || row < 0 || col >= SIZE || row >= SIZE) return
      // 교차점에서 너무 먼 탭은 무시 (오조작 방지)
      if (Math.abs(p.x - (X0 + col * CELL)) > CELL * 0.45) return
      if (Math.abs(p.y - (Y0 + row * CELL)) > CELL * 0.45) return
      const result = playerMove(state, row * SIZE + col)
      if (result === 'invalid') return
      playDrop()
      vibrate(10)
      if (result === 'win') {
        playMerge(6)
        vibrate([30, 60, 30])
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawStone = (c: CanvasRenderingContext2D, x: number, y: number, black: boolean) => {
    const g = c.createRadialGradient(x - 6, y - 6, 3, x, y, 20)
    if (black) {
      g.addColorStop(0, '#555555')
      g.addColorStop(1, '#111111')
    } else {
      g.addColorStop(0, '#FFFFFF')
      g.addColorStop(1, '#CFCFCF')
    }
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, 19, 0, Math.PI * 2)
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#4E342E', '#D7A86E')

    // HUD: 점수(연승 기반) + 연승 수
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.94)',
      labelColor: '#BCAAA4',
      valueColor: '#4E342E',
    })
    c.fillStyle = '#8D6E63'
    c.font = font(24, true)
    c.fillText(t('om.stage', { n: state.stage, m: MAX_STAGE }), SCORE_PANEL.cx, SCORE_PANEL.subY)
    // 제한 시간이 있는 단은 남은 시간을 크게 보여준다 (10초 아래면 빨갛게)
    if (state.timeLeft > 0 || state.stage >= TIMED_FROM) {
      const left = Math.ceil(state.timeLeft)
      const urgent = left <= 10
      c.fillStyle = urgent ? '#E53935' : '#5D4037'
      c.font = font(30, true)
      drawIconValue(
        c,
        'timer',
        `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
        SCORE_PANEL.cx,
        200,
        16,
        'center',
        { color: urgent ? '#E53935' : '#6D4C41' },
      )
    }

    // 차례 안내
    c.fillStyle = '#FFF8E1'
    c.font = font(28, true)
    if (state.phase === 'playing') c.fillText(t('om.you'), 360, 232)
    else if (state.phase === 'aiThinking') c.fillText(t('om.think'), 360, 232)

    // 바둑판
    c.fillStyle = '#E8BB77'
    c.beginPath()
    c.roundRect(X0 - 26, Y0 - 26, BOARD_W + 52, BOARD_W + 52, 14)
    c.fill()
    c.strokeStyle = '#6D4C41'
    c.lineWidth = 1.6
    c.beginPath()
    for (let i = 0; i < SIZE; i++) {
      c.moveTo(X0, Y0 + i * CELL)
      c.lineTo(X0 + BOARD_W, Y0 + i * CELL)
      c.moveTo(X0 + i * CELL, Y0)
      c.lineTo(X0 + i * CELL, Y0 + BOARD_W)
    }
    c.stroke()
    // 화점
    c.fillStyle = '#6D4C41'
    for (const gx of [3, 7, 11]) {
      for (const gy of [3, 7, 11]) {
        c.beginPath()
        c.arc(X0 + gx * CELL, Y0 + gy * CELL, 4, 0, Math.PI * 2)
        c.fill()
      }
    }

    // 돌
    for (let i = 0; i < state.board.length; i++) {
      const stone = state.board[i]
      if (stone === 0) continue
      const x = X0 + (i % SIZE) * CELL
      const y = Y0 + Math.floor(i / SIZE) * CELL
      drawStone(c, x, y, stone === 1)
    }
    // 마지막 수 표시
    if (state.lastMove >= 0 && state.board[state.lastMove] !== 0) {
      const x = X0 + (state.lastMove % SIZE) * CELL
      const y = Y0 + Math.floor(state.lastMove / SIZE) * CELL
      c.fillStyle = '#E53935'
      c.beginPath()
      c.arc(x, y, 5, 0, Math.PI * 2)
      c.fill()
    }
    // 승리 라인 강조
    for (const i of state.winLine) {
      const x = X0 + (i % SIZE) * CELL
      const y = Y0 + Math.floor(i / SIZE) * CELL
      c.strokeStyle = '#FFD54F'
      c.lineWidth = 4
      c.beginPath()
      c.arc(x, y, 22, 0, Math.PI * 2)
      c.stroke()
    }

    // 광고 무르기 버튼
    if (state.phase === 'playing' && ctx.isRewardAdReady() && !undoUsed && state.history.length >= 2) {
      c.fillStyle = '#43A047'
      c.beginPath()
      c.roundRect(UNDO_BTN.x, UNDO_BTN.y, UNDO_BTN.w, UNDO_BTN.h, 24)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(28, true)
      c.textBaseline = 'middle'
      c.fillText(t('om.undo'), 360, UNDO_BTN.y + UNDO_BTN.h / 2 + 1)
      c.textBaseline = 'alphabetic'
    }

    // 승/패 배너
    if (state.phase === 'won' || state.phase === 'lost') {
      c.save()
      c.fillStyle = 'rgb(0 0 0 / 0.5)'
      c.fillRect(0, 560, 720, 140)
      c.fillStyle = state.phase === 'won' ? '#FFD54F' : '#EF9A9A'
      c.font = font(52, true)
      c.textBaseline = 'middle'
      const banner = state.cleared
        ? t('om.cleared')
        : state.phase === 'won'
          ? t('om.win', { n: state.stage })
          : state.stage >= TIMED_FROM && state.timeLeft <= 0
            ? t('om.timeout')
            : t('om.lose')
      c.fillText(banner, 360, state.lastBonus > 0 && state.phase === 'won' ? 610 : 630)
      if (state.phase === 'won' && state.lastBonus > 0) {
        c.fillStyle = '#FFF8E1'
        c.font = font(28, true)
        c.fillText(t('om.timeBonus', { n: state.lastBonus.toLocaleString() }), 360, 660)
      }
      c.restore()
      c.textBaseline = 'alphabetic'
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
