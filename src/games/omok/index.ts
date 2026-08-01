import { t } from '@/shared/i18n'
import { playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  applyAiMove,
  createState,
  loadProgress,
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
import { ground } from '../scene'

// 화면 배치 (논리 720×1280): 교차점 방식 바둑판
const CELL = 44
const BOARD_W = CELL * (SIZE - 1)
const X0 = (720 - BOARD_W) / 2
const Y0 = 300
const UNDO_BTN = { x: 180, y: 1010, w: 360, h: 92 } as const
const RESUME_BTN = { x: 140, y: 528, w: 440, h: 104 } as const
const FRESH_BTN = { x: 140, y: 656, w: 440, h: 88 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.thinkTimer -= dt
    clock += dt
    placeFx = Math.max(0, placeFx - dt * 4)
    // 제한 시간이 붙는 단(6단~)에서 내 차례일 때만 시계가 간다
    if (state.phase === 'playing' && tickClock(state, dt)) {
      state.phase = 'lost'
      state.resultTimer = 2
      vibrate(80)
      playGameOver()
    }
    if (state.phase === 'aiThinking' && state.thinkTimer <= 0) {
      const result = applyAiMove(state)
      playSfx('stone', { rate: 0.94 })
      placeFx = 1
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
  preloadSfx('gameover', 'merge', 'stone')
  let undoUsed = false // 판당 1회 광고 무르기
  let aiming: number | null = null // 손가락이 겨누고 있는 교차점 (떼면 확정)
  let placeFx = 0 // 돌이 놓이며 내려앉는 연출
  let clock = 0 // 미리보기 표식을 흔드는 시계
  let adContinueUsed = false
  // 지난 판에서 어디까지 갔는지 — 있으면 첫 화면에서 이어할지 묻는다
  let saved = loadProgress()
  if (saved) state.phase = 'intro'

  const beginRun = () => {
    Object.assign(state, createState())
    saved = loadProgress()
    if (saved) state.phase = 'intro'
    undoUsed = false
    adContinueUsed = false
  }

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'om.ad',
    onRetry() {
      if (state.phase !== 'over') return
      beginRun()
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
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    // 진 이유는 판을 보면 알지만, 시간 초과는 판에 흔적이 남지 않는다
    const reason = state.cleared
      ? 'over.byClear'
      : state.stage >= TIMED_FROM && state.timeLeft <= 0
        ? 'over.byTime'
        : undefined
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adContinueUsed && !state.cleared,
      reason,
    )
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

  // 교차점 간격이 44px(손끝의 절반)이라 누르는 즉시 두면 옆자리에 놓이기 쉽다.
  // 눌러서 미리 보고, 손을 떼면 그 자리에 둔다 — 손가락을 끌어 자리를 고칠 수 있다.
  const pointAt = (x: number, y: number): number | null => {
    const col = Math.round((x - X0) / CELL)
    const row = Math.round((y - Y0) / CELL)
    if (col < 0 || row < 0 || col >= SIZE || row >= SIZE) return null
    // 판 밖으로 크게 벗어난 곳은 받지 않는다
    if (Math.abs(x - (X0 + col * CELL)) > CELL * 0.85) return null
    if (Math.abs(y - (Y0 + row * CELL)) > CELL * 0.85) return null
    return row * SIZE + col
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase === 'intro') {
        const hit = (b: { x: number; y: number; w: number; h: number }) =>
          p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
        if (saved && hit(RESUME_BTN)) {
          state.score = saved.score
          startStage(state, saved.stage)
          playSfx('stone')
        } else if (hit(FRESH_BTN)) {
          state.phase = 'playing'
          playSfx('stone')
        }
        return
      }
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
      const at = pointAt(p.x, p.y)
      if (at !== null && state.board[at] === 0) aiming = at
    },
    onMove(clientX, clientY) {
      if (aiming === null || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      const at = pointAt(p.x, p.y)
      if (at !== null && state.board[at] === 0) aiming = at
    },
    onUp() {
      const at = aiming
      aiming = null
      if (at === null || state.phase !== 'playing') return
      const result = playerMove(state, at)
      if (result === 'invalid') return
      playSfx('stone')
      vibrate(10)
      placeFx = 1
      if (result === 'win') {
        playMerge(6)
        vibrate([30, 60, 30])
      }
    },
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
    const c = stage.begin(ground('#4E342E', '#1A100B'), ground('#D7A86E', '#4A331F'))

    // HUD: 점수(연승 기반) + 연승 수
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: ground('rgb(255 255 255 / 0.94)', 'rgb(22 14 9 / 0.86)'),
      labelColor: ground('#BCAAA4', '#8F7D74'),
      valueColor: ground('#4E342E', '#E5D8D0'),
    })
    c.fillStyle = ground('#8D6E63', '#B9A69C')
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
    c.fillStyle = ground('#E8BB77', '#5A3F27')
    c.beginPath()
    c.roundRect(X0 - 26, Y0 - 26, BOARD_W + 52, BOARD_W + 52, 14)
    c.fill()
    c.strokeStyle = ground('#6D4C41', '#8A6A4E')
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
    c.fillStyle = ground('#6D4C41', '#8A6A4E')
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
    // 겨누고 있는 자리 — 손을 떼면 여기 놓인다. 십자선이 있어야 옆칸과 헷갈리지 않는다.
    if (aiming !== null) {
      const x = X0 + (aiming % SIZE) * CELL
      const y = Y0 + Math.floor(aiming / SIZE) * CELL
      c.save()
      c.strokeStyle = 'rgb(229 57 53 / 0.55)'
      c.lineWidth = 2
      c.setLineDash([6, 6])
      c.beginPath()
      c.moveTo(X0, y)
      c.lineTo(X0 + BOARD_W, y)
      c.moveTo(x, Y0)
      c.lineTo(x, Y0 + BOARD_W)
      c.stroke()
      c.setLineDash([])
      c.globalAlpha = 0.55
      drawStone(c, x, y, true)
      c.globalAlpha = 1
      c.strokeStyle = '#E53935'
      c.lineWidth = 3
      c.beginPath()
      c.arc(x, y, 23 + Math.sin(clock * 6) * 2, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    // 마지막 수 표시
    if (state.lastMove >= 0 && state.board[state.lastMove] !== 0) {
      const x = X0 + (state.lastMove % SIZE) * CELL
      const y = Y0 + Math.floor(state.lastMove / SIZE) * CELL
      // 방금 놓인 돌 주위로 파문이 퍼진다 — AI가 어디에 뒀는지 눈이 바로 찾는다
      if (placeFx > 0) {
        c.save()
        c.globalAlpha = placeFx * 0.7
        c.strokeStyle = '#E53935'
        c.lineWidth = 4 * placeFx
        c.beginPath()
        c.arc(x, y, 19 + (1 - placeFx) * 30, 0, Math.PI * 2)
        c.stroke()
        c.restore()
      }
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

    // 이어하기 물음 — 지난 판에서 올라간 단이 있을 때만 첫 화면에 뜬다
    if (state.phase === 'intro' && saved) {
      c.fillStyle = 'rgb(38 24 18 / 0.72)'
      c.fillRect(0, 0, 720, 1280)
      c.textAlign = 'center'
      c.fillStyle = '#FFF8E1'
      c.font = font(36, true)
      c.fillText(t('om.resumeTitle'), 360, 470)

      c.fillStyle = '#43A047'
      c.beginPath()
      c.roundRect(RESUME_BTN.x, RESUME_BTN.y, RESUME_BTN.w, RESUME_BTN.h, 26)
      c.fill()
      c.textBaseline = 'middle'
      c.fillStyle = '#FFFFFF'
      c.font = font(30, true)
      c.fillText(t('om.resume', { n: saved.stage }), 360, RESUME_BTN.y + 42)
      c.font = font(22)
      c.fillStyle = 'rgb(255 255 255 / 0.8)'
      c.fillText(`${t('hud.score')} ${saved.score.toLocaleString()}`, 360, RESUME_BTN.y + 76)

      c.fillStyle = 'rgb(255 255 255 / 0.14)'
      c.beginPath()
      c.roundRect(FRESH_BTN.x, FRESH_BTN.y, FRESH_BTN.w, FRESH_BTN.h, 24)
      c.fill()
      c.strokeStyle = 'rgb(255 255 255 / 0.3)'
      c.lineWidth = 2
      c.stroke()
      c.fillStyle = '#FFF8E1'
      c.font = font(26, true)
      c.fillText(t('om.fresh'), 360, FRESH_BTN.y + FRESH_BTN.h / 2 + 1)
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
