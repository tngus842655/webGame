import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { clearPoints, createState, loadLevel, rotateTile, D, L, R, U } from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconValue } from '../icons'

// 화면 배치 (논리 720×1280)
const GRID_X = 36
const GRID_Y = 300
const GRID_W = 648
const BAR = { x: 36, y: 224, w: 648, h: 26 } as const

const popcount = (m: number) => ((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1))

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'playing') {
      state.timeLeft -= dt
      if (state.timeLeft <= 0) {
        state.timeLeft = 0
        state.phase = 'over'
        state.overTimer = 0.6
      }
    }
    if (state.phase === 'clearing') {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) {
        loadLevel(state, state.level + 1)
        angleOff.fill(0)
        state.phase = 'playing'
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    // 회전 애니메이션: 목표 각도(0)로 수렴
    for (let i = 0; i < angleOff.length; i++) {
      if (angleOff[i] < 0) angleOff[i] = Math.min(0, angleOff[i] + dt * 620)
    }
    if (popup) {
      popup.age += dt
      if (popup.age > 1.2) popup = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'gameover', 'tap', 'water')
  const angleOff = new Array<number>(49).fill(0) // 타일별 표시 각도 오프셋(도)
  let popup: { text: string; age: number } | null = null
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'pp.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      angleOff.fill(0)
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 시간 30초를 받고 같은 판을 이어서 푼다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('pipes-time')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.timeLeft = 30
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

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      const cell = GRID_W / state.size
      const col = Math.floor((p.x - GRID_X) / cell)
      const row = Math.floor((p.y - GRID_Y) / cell)
      if (row < 0 || col < 0 || row >= state.size || col >= state.size) return
      const i = row * state.size + col
      const prevWet = state.wetCount
      const result = rotateTile(state, i)
      if (result === 'none') return
      angleOff[i] -= 90
      playDrop()
      vibrate(10)
      if (state.wetCount > prevWet) playSfx('water', { gain: 0.7 })
      if (result === 'solved') {
        const points = clearPoints(state)
        state.score = Math.min(1_000_000, state.score + points)
        popup = { text: `+${points}`, age: 0 }
        playSfx('clear')
        vibrate(30)
        state.phase = 'clearing'
        state.clearTimer = 1.4
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#1565C0', '#E3F2FD')
    const size = state.size
    const cell = GRID_W / size
    const clearing = state.phase === 'clearing'

    // HUD 카드: 점수 + 레벨 + 연결된 칸 수
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.94)',
      labelColor: '#90CAF9',
      valueColor: '#0D47A1',
    })
    c.fillStyle = '#1565C0'
    c.font = font(24)
    c.textAlign = 'left'
    c.fillText(t('pp.level', { n: state.level }), SCORE_PANEL.left, SCORE_PANEL.subY)
    drawIconValue(
      c,
      'drop',
      `${state.wetCount}/${size * size}`,
      SCORE_PANEL.right,
      SCORE_PANEL.subY - 8,
      13,
      'right',
    )
    c.textAlign = 'center'

    // 남은 시간 바
    const ratio = Math.max(0, Math.min(1, state.timeLeft / (40 + (size - 4) * 15)))
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.5
    c.beginPath()
    c.roundRect(BAR.x, BAR.y, BAR.w, BAR.h, 13)
    c.fill()
    c.restore()
    if (ratio > 0) {
      c.fillStyle = ratio > 0.5 ? '#26A69A' : ratio > 0.25 ? '#FFA726' : '#EF5350'
      c.beginPath()
      c.roundRect(BAR.x, BAR.y, Math.max(BAR.h, BAR.w * ratio), BAR.h, 13)
      c.fill()
    }
    c.fillStyle = '#FFFFFF'
    c.font = font(20, true)
    c.textBaseline = 'middle'
    c.fillText(`${Math.ceil(state.timeLeft)}s`, BAR.x + BAR.w / 2, BAR.y + BAR.h / 2 + 1)
    c.textBaseline = 'alphabetic'

    // 타일
    for (let i = 0; i < size * size; i++) {
      const col = i % size
      const row = Math.floor(i / size)
      const x = GRID_X + col * cell
      const y = GRID_Y + row * cell
      const mask = state.masks[i]
      const wet = state.wet[i]
      const isSource = i === state.source

      c.fillStyle = wet ? '#E1F5FE' : '#FFFFFF'
      c.beginPath()
      c.roundRect(x + 3, y + 3, cell - 6, cell - 6, 10)
      c.fill()

      if (mask === 0) continue
      const cx = x + cell / 2
      const cy = y + cell / 2
      const half = cell / 2 - 3
      // 물이 찼을 때는 클리어 연출에서 살짝 맥동
      const pulse = clearing ? 1 + Math.sin(state.playTime * 10) * 0.08 : 1
      c.save()
      c.translate(cx, cy)
      c.rotate((angleOff[i] * Math.PI) / 180)
      c.strokeStyle = wet ? '#29B6F6' : '#90A4AE'
      c.lineWidth = cell * 0.26 * pulse
      c.lineCap = 'round'
      c.beginPath()
      if (mask & U) {
        c.moveTo(0, 0)
        c.lineTo(0, -half)
      }
      if (mask & R) {
        c.moveTo(0, 0)
        c.lineTo(half, 0)
      }
      if (mask & D) {
        c.moveTo(0, 0)
        c.lineTo(0, half)
      }
      if (mask & L) {
        c.moveTo(0, 0)
        c.lineTo(-half, 0)
      }
      c.stroke()
      c.restore()

      if (isSource) {
        // 펌프: 초록 사각 + 물방울
        c.fillStyle = '#43A047'
        c.beginPath()
        c.roundRect(cx - cell * 0.22, cy - cell * 0.22, cell * 0.44, cell * 0.44, 8)
        c.fill()
        c.fillStyle = '#E8F5E9'
        c.beginPath()
        c.arc(cx, cy, cell * 0.1, 0, Math.PI * 2)
        c.fill()
      } else if (popcount(mask) === 1) {
        // 끝 꼭지: 물이 닿으면 불이 들어온다
        c.fillStyle = wet ? '#FFB300' : '#CFD8DC'
        c.beginPath()
        c.arc(cx, cy, cell * 0.16, 0, Math.PI * 2)
        c.fill()
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.arc(cx, cy, cell * 0.07, 0, Math.PI * 2)
        c.fill()
      } else {
        c.fillStyle = wet ? '#29B6F6' : '#90A4AE'
        c.beginPath()
        c.arc(cx, cy, cell * 0.14, 0, Math.PI * 2)
        c.fill()
      }
    }

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
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  // 시간제한 게임 — 제한 시간을 다 쓴 결과만 기록한다
  return shell
}

export default defineGame(createSession)
