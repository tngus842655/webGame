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

const STATUS_COLORS: Record<CellStatus, string> = { g: '#6AAA64', y: '#C9B458', x: '#787C7E' }

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
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let toast: { text: string; age: number; life: number } | null = null
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
    const result = submitGuess(state)
    if (result === 'none') return
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
      if (state.dailyShare && p.x >= 560 && p.x <= 700 && p.y >= 96 && p.y <= 156) {
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
  ) => {
    const x = GRID_X + col * (CELL + GAP)
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
      c.font = 'bold 46px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(jamo, x + CELL / 2, rowY + CELL / 2 + 2)
      c.textBaseline = 'alphabetic'
    }
  }

  const draw = () => {
    const c = stage.begin('#263238', '#ECEFF1')

    // 상단: 라벨 + 스트릭 + 점수 + 공유
    c.textAlign = 'left'
    c.fillStyle = '#455A64'
    c.font = 'bold 28px sans-serif'
    const d = new Date()
    const label = state.daily
      ? t('sd.daily', { date: `${d.getMonth() + 1}/${d.getDate()}` })
      : t('sd.practice', { n: state.practiceCount })
    c.fillText(`${label} · ${t('sd.streak', { n: state.streak })}`, 24, 64)
    c.textAlign = 'right'
    c.fillStyle = '#263238'
    c.font = 'bold 40px sans-serif'
    c.fillText(state.score.toLocaleString(), 696, 66)
    c.textAlign = 'center'
    if (state.dailyShare) {
      c.fillStyle = '#455A64'
      c.beginPath()
      c.roundRect(560, 96, 140, 60, 16)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 26px sans-serif'
      c.textBaseline = 'middle'
      c.fillText(t('wd.share'), 630, 128)
      c.textBaseline = 'alphabetic'
    }

    // 그리드: 확정 행 + 입력 행 + 빈 행
    for (let row = 0; row < state.maxRows; row++) {
      const y = GRID_Y + row * ROW_H
      if (row < state.rows.length) {
        for (let col = 0; col < WORD_LEN; col++) {
          drawCell(c, col, y, state.rows[row][col], state.results[row][col])
        }
      } else if (row === state.rows.length && state.phase === 'playing') {
        for (let col = 0; col < WORD_LEN; col++) {
          drawCell(c, col, y, state.current[col] ?? null, null)
        }
      } else {
        for (let col = 0; col < WORD_LEN; col++) drawCell(c, col, y, null, null)
      }
    }

    // 정답 연출
    if (state.phase === 'won') {
      c.save()
      c.font = 'bold 56px sans-serif'
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
      c.font = 'bold 36px sans-serif'
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
        c.fillStyle = '#37474F'
        c.fillText('⌫', backX + 60, y + KEY_H / 2 + 2)
        const ready = state.current.length === WORD_LEN && state.phase === 'playing'
        c.fillStyle = ready ? '#6AAA64' : '#B0BEC5'
        c.beginPath()
        c.roundRect(backX + 128, y, 190, KEY_H, 12)
        c.fill()
        c.fillStyle = '#FFFFFF'
        c.font = 'bold 30px sans-serif'
        c.fillText(t('wd.enter'), backX + 128 + 95, y + KEY_H / 2 + 2)
      }
      c.textBaseline = 'alphabetic'
    }

    // 토스트
    if (toast) {
      c.save()
      c.globalAlpha = Math.min(1, (toast.life - toast.age) / 0.4)
      c.fillStyle = 'rgb(38 50 56 / 0.9)'
      c.font = 'bold 32px sans-serif'
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
  return shell
}

export default defineGame(createSession)
