import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  createState,
  nextPracticeWord,
  submitGuess,
  WORD_LEN,
  type CellStatus,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIcon } from '../icons'

// 화면 배치 (논리 720×1280)
const CELL = 84
const GAP = 8
const GRID_X = (720 - (CELL * WORD_LEN + GAP * (WORD_LEN - 1))) / 2
const GRID_Y = 200
const ROW_H = CELL + GAP
const KEY_ROWS = ['ㄱㄴㄷㄹㅁㅂㅅ', 'ㅇㅈㅊㅋㅌㅍㅎ', 'ㅏㅑㅓㅕㅗㅛㅜ', 'ㅠㅡㅣ'].map((r) => [...r])
const KEY_Y = 916
const KEY_H = 76
const KEY_GAP = 10
const KEY_W = 90
const SHARE_BTN = { x: 588, y: 96, w: 120, h: 56 } as const

const STATUS_COLORS: Record<CellStatus, string> = { g: '#6AAA64', y: '#C9B458', x: '#787C7E' }
// 한 칸이 뒤집히는 시간과 칸 사이 시차
const REVEAL_TURN = 0.34
const REVEAL_STEP = 0.13

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (toast) {
      toast.age += dt
      if (toast.age > toast.life) toast = null
    }
    if (state.phase === 'won') {
      state.wonTimer -= dt
      if (state.wonTimer <= 0) nextPracticeWord(state)
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    if (reveal.row >= 0) {
      reveal.t += dt
      if (reveal.t > REVEAL_STEP * (WORD_LEN - 1) + REVEAL_TURN) reveal.row = -1
    }
    shakeRow = Math.max(0, shakeRow - dt * 3.2)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let toast: { text: string; age: number; life: number } | null = null
  // 제출한 줄이 한 칸씩 뒤집히며 결과를 연다 — 이 게임에서 가장 중요한 순간이다
  let reveal = { row: -1, t: 0 }
  let shakeRow = 0
  let lastPoints = 0
  let adContinueUsed = false

  const showToast = (text: string, life = 1.6) => {
    toast = { text, age: 0, life }
  }

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'wd.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      const keep = state.dailyShare
      Object.assign(state, createState(), { dailyShare: keep })
      // 데일리를 이미 풀었다면 바로 연습 단어부터
      if (keep !== null) nextPracticeWord(state)
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 실패한 단어에 한 줄을 더 받는다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('wordle-row')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.maxRows = 7
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adContinueUsed && state.maxRows < 7,
    )
  }

  const shareResult = () => {
    if (!state.dailyShare) return
    const d = new Date()
    const text = `${t('app.title')} ${t('game.wordle')} ${d.getMonth() + 1}/${d.getDate()}\n${state.dailyShare}`
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(t('wd.copied')))
      .catch(() => showToast('…'))
  }

  const pressKey = (jamo: string) => {
    if (state.phase !== 'playing' || state.current.length >= WORD_LEN) return
    state.current.push(jamo)
    playDrop()
  }

  const submit = () => {
    const prevScore = state.score
    const rowIndex = state.rows.length
    const result = submitGuess(state)
    if (result === 'none') {
      // 여섯 칸을 다 못 채웠거나 없는 단어 — 아무 반응이 없으면 고장으로 보인다
      shakeRow = 1
      playDrop()
      vibrate(40)
      return
    }
    reveal = { row: rowIndex, t: 0 }
    if (result === 'won') {
      lastPoints = state.score - prevScore
      playMerge(6)
      vibrate([20, 40, 20])
    } else if (result === 'lost') {
      vibrate(80)
      showToast(t('wd.answer', { word: state.word.hangul }), 2.2)
    } else {
      playMerge(2)
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      // 공유 버튼 (데일리 결과가 있을 때)
      if (
        state.dailyShare &&
        p.x >= SHARE_BTN.x &&
        p.x <= SHARE_BTN.x + SHARE_BTN.w &&
        p.y >= SHARE_BTN.y &&
        p.y <= SHARE_BTN.y + SHARE_BTN.h
      ) {
        shareResult()
        return
      }
      if (state.phase !== 'playing') return
      // 키보드
      for (let row = 0; row < KEY_ROWS.length; row++) {
        const y = KEY_Y + row * (KEY_H + KEY_GAP)
        if (p.y < y || p.y > y + KEY_H) continue
        const keys = KEY_ROWS[row]
        const x0 = row < 3 ? 20 : 54
        for (let k = 0; k < keys.length; k++) {
          const x = x0 + k * (KEY_W + GAP)
          if (p.x >= x && p.x <= x + KEY_W) {
            pressKey(keys[k])
            return
          }
        }
        if (row === 3) {
          const backX = x0 + 3 * (KEY_W + GAP)
          if (p.x >= backX && p.x <= backX + 120) {
            if (state.current.length > 0) {
              state.current.pop()
              playDrop()
            }
            return
          }
          const enterX = backX + 128
          if (p.x >= enterX && p.x <= enterX + 190) submit()
        }
        return
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawCell = (
    c: CanvasRenderingContext2D,
    col: number,
    rowY: number,
    jamo: string | null,
    status: CellStatus | null,
    flip = 1,
  ) => {
    const x = GRID_X + col * (CELL + GAP)
    // 뒤집히는 중에는 세로로 납작해진다 (flip 1 = 평소)
    if (flip !== 1) {
      c.save()
      c.translate(0, rowY + CELL / 2)
      c.scale(1, Math.max(0.04, flip))
      c.translate(0, -(rowY + CELL / 2))
    }
    if (status) {
      c.fillStyle = STATUS_COLORS[status]
      c.beginPath()
      c.roundRect(x, rowY, CELL, CELL, 10)
      c.fill()
    } else {
      c.fillStyle = '#FFFFFF'
      c.strokeStyle = jamo ? '#78909C' : '#CFD8DC'
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(x, rowY, CELL, CELL, 10)
      c.fill()
      c.stroke()
    }
    if (jamo) {
      c.fillStyle = status ? '#FFFFFF' : '#263238'
      c.font = font(46, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(jamo, x + CELL / 2, rowY + CELL / 2 + 2)
      c.textBaseline = 'alphabetic'
    }
    if (flip !== 1) c.restore()
  }

  // 뒤집히는 줄의 col번째 칸 상태 — 절반을 넘어야 결과 색이 드러난다
  const revealOf = (row: number, col: number): { flip: number; open: boolean } => {
    if (reveal.row !== row) return { flip: 1, open: true }
    const k = (reveal.t - col * REVEAL_STEP) / REVEAL_TURN
    if (k <= 0) return { flip: 1, open: false }
    if (k >= 1) return { flip: 1, open: true }
    return { flip: Math.abs(Math.cos(k * Math.PI)), open: k >= 0.5 }
  }

  const draw = () => {
    const c = stage.begin('#263238', '#ECEFF1')

    // 상단: 라벨 + 스트릭 + 점수 + 공유
    c.textAlign = 'left'
    const d = new Date()
    const label = state.daily
      ? t('sd.daily', { date: `${d.getMonth() + 1}/${d.getDate()}` })
      : t('sd.practice', { n: state.practiceCount })
    // 밝은 판 위라 흰 판에 어두운 글씨를 쓴다 (공통 점수판 규격)
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.92)',
      labelColor: '#B0BEC5',
      valueColor: '#263238',
    })
    c.textAlign = 'center'
    c.fillStyle = '#78909C'
    c.font = font(20, true)
    c.fillText(`${label} · ${t('sd.streak', { n: state.streak })}`, SCORE_PANEL.cx, SCORE_PANEL.subY)
    if (state.dailyShare) {
      c.fillStyle = '#455A64'
      c.beginPath()
      c.roundRect(SHARE_BTN.x, SHARE_BTN.y, SHARE_BTN.w, SHARE_BTN.h, 16)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(24, true)
      c.textBaseline = 'middle'
      c.fillText(t('wd.share'), SHARE_BTN.x + SHARE_BTN.w / 2, SHARE_BTN.y + SHARE_BTN.h / 2)
      c.textBaseline = 'alphabetic'
    }

    // 그리드: 확정 행 + 입력 행 + 빈 행
    for (let row = 0; row < state.maxRows; row++) {
      const y = GRID_Y + row * ROW_H
      if (row < state.rows.length) {
        for (let col = 0; col < WORD_LEN; col++) {
          const rv = revealOf(row, col)
          drawCell(c, col, y, state.rows[row][col], rv.open ? state.results[row][col] : null, rv.flip)
        }
      } else if (row === state.rows.length && state.phase === 'playing') {
        // 낼 수 없는 줄은 좌우로 흔들린다
        c.save()
        if (shakeRow > 0) c.translate(Math.sin(shakeRow * 34) * 12 * shakeRow, 0)
        for (let col = 0; col < WORD_LEN; col++) {
          drawCell(c, col, y, state.current[col] ?? null, null)
        }
        c.restore()
      } else {
        for (let col = 0; col < WORD_LEN; col++) drawCell(c, col, y, null, null)
      }
    }

    // 정답 연출
    if (state.phase === 'won') {
      c.save()
      c.font = font(56, true)
      c.fillStyle = '#6AAA64'
      c.lineWidth = 8
      c.strokeStyle = '#FFFFFF'
      const text = `${state.word.hangul}! +${lastPoints}`
      c.strokeText(text, 360, 170)
      c.fillText(text, 360, 170)
      c.restore()
    }

    // 키보드
    for (let row = 0; row < KEY_ROWS.length; row++) {
      const y = KEY_Y + row * (KEY_H + KEY_GAP)
      const keys = KEY_ROWS[row]
      const x0 = row < 3 ? 20 : 54
      c.font = font(36, true)
      c.textBaseline = 'middle'
      for (let k = 0; k < keys.length; k++) {
        const x = x0 + k * (KEY_W + GAP)
        const status = state.keyStatus[keys[k]]
        c.fillStyle = status ? STATUS_COLORS[status] : '#CFD8DC'
        c.beginPath()
        c.roundRect(x, y, KEY_W, KEY_H, 12)
        c.fill()
        c.fillStyle = status ? '#FFFFFF' : '#37474F'
        c.fillText(keys[k], x + KEY_W / 2, y + KEY_H / 2 + 2)
      }
      if (row === 3) {
        const backX = x0 + 3 * (KEY_W + GAP)
        c.fillStyle = '#B0BEC5'
        c.beginPath()
        c.roundRect(backX, y, 120, KEY_H, 12)
        c.fill()
        drawIcon(c, 'backspace', backX + 60, y + KEY_H / 2, 20, { color: '#37474F' })
        const ready = state.current.length === WORD_LEN && state.phase === 'playing'
        c.fillStyle = ready ? '#6AAA64' : '#B0BEC5'
        c.beginPath()
        c.roundRect(backX + 128, y, 190, KEY_H, 12)
        c.fill()
        c.fillStyle = '#FFFFFF'
        c.font = font(30, true)
        c.fillText(t('wd.enter'), backX + 128 + 95, y + KEY_H / 2 + 2)
      }
      c.textBaseline = 'alphabetic'
    }

    // 토스트
    if (toast) {
      c.save()
      c.globalAlpha = Math.min(1, (toast.life - toast.age) / 0.4)
      c.fillStyle = 'rgb(38 50 56 / 0.9)'
      c.font = font(32, true)
      const w = c.measureText(toast.text).width + 60
      c.beginPath()
      c.roundRect(360 - w / 2, 440, w, 74, 20)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.textBaseline = 'middle'
      c.fillText(toast.text, 360, 478)
      c.restore()
      c.textBaseline = 'alphabetic'
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
