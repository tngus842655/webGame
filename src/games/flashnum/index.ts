import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BUBBLE_R,
  createState,
  reviveAtLevel,
  startLevel,
  tapAt,
  update,
  type Bubble,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconRow } from '../icons'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'fail', 'gameover', 'pop')
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'fn.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('flashnum-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveAtLevel(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed, 'over.byLives')
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const result = tapAt(state, p.x, p.y)
      if (result === 'correct') {
        playSfx('pop', { rate: Math.min(1.6, 1 + state.next * 0.05) })
        vibrate(10)
      } else if (result === 'clear') {
        playSfx('clear')
        vibrate([15, 40, 25])
      } else if (result === 'wrong') {
        playSfx('fail')
        vibrate(110)
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawBubble = (b: Bubble, showNumber: boolean) => {
    const c = stage.c
    if (b.popped) {
      if (b.pop >= 1) return
      // 터지는 순간: 고리가 퍼지며 사라진다
      c.save()
      c.globalAlpha = 1 - b.pop
      c.strokeStyle = '#B3E5FC'
      c.lineWidth = 6 * (1 - b.pop) + 1
      c.beginPath()
      c.arc(b.x, b.y, BUBBLE_R * (1 + b.pop * 0.6), 0, Math.PI * 2)
      c.stroke()
      c.restore()
      return
    }

    const isNext = b.n === state.next
    c.beginPath()
    c.arc(b.x, b.y, BUBBLE_R, 0, Math.PI * 2)
    if (b.wrong) c.fillStyle = 'rgb(239 83 80 / 0.85)'
    else if (showNumber) c.fillStyle = '#4FC3F7'
    else c.fillStyle = 'rgb(255 255 255 / 0.17)'
    c.fill()
    c.lineWidth = state.phase === 'penalty' && isNext ? 7 : 3
    c.strokeStyle =
      state.phase === 'penalty' && isNext
        ? '#66BB6A'
        : showNumber
          ? 'rgb(255 255 255 / 0.6)'
          : 'rgb(255 255 255 / 0.42)'
    c.stroke()
    // 다음에 눌러야 할 자리는 벌칙 동안 맥동해서 눈에 먼저 들어온다
    if (state.phase === 'penalty' && isNext) {
      c.save()
      c.globalAlpha = 0.3 + 0.35 * Math.sin(state.playTime * 8)
      c.strokeStyle = '#66BB6A'
      c.lineWidth = 5
      c.beginPath()
      c.arc(b.x, b.y, BUBBLE_R + 12, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    // 물방울 광택
    if (showNumber || b.wrong) {
      c.save()
      c.globalAlpha = 0.4
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(b.x - 16, b.y - 22, 15, 10, -0.5, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    if (showNumber) {
      c.fillStyle = b.wrong ? '#FFFFFF' : '#06323F'
      c.font = font(46, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(b.n), b.x, b.y + 2)
      c.textBaseline = 'alphabetic'
    }
  }

  const draw = () => {
    const c = stage.begin('#062330', '#0C3B4C')

    // 물결 — 배경이 비어 보이지 않게 아주 옅게
    c.strokeStyle = 'rgb(255 255 255 / 0.03)'
    c.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      c.beginPath()
      c.arc(360, 700, 120 + i * 110, 0, Math.PI * 2)
      c.stroke()
    }

    const showNumbers = state.phase === 'reveal' || state.phase === 'penalty'
    for (const b of state.bubbles) drawBubble(b, showNumbers)

    c.textAlign = 'center'

    // 노출 시간 막대 — 얼마나 더 볼 수 있는지 보여 준다
    if (state.phase === 'reveal') {
      const w = 400
      c.fillStyle = 'rgb(255 255 255 / 0.12)'
      c.beginPath()
      c.roundRect(360 - w / 2, 236, w, 12, 6)
      c.fill()
      c.fillStyle = '#FFD54F'
      c.beginPath()
      c.roundRect(360 - w / 2, 236, w * (state.showTimer / state.showSpan), 12, 6)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.75)'
      c.font = font(22)
      c.fillText(t('fn.memorize'), 360, 218)
    } else if (state.phase === 'recall' && state.level <= 2) {
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = font(22)
      c.fillText(t('fn.order'), 360, 240)
    }

    if (state.phase === 'clear') {
      c.fillStyle = '#FFD54F'
      c.font = font(38, true)
      c.fillText(`+${state.gain}`, 360, 240)
    }

    // 틀린 순간 화면 테두리가 붉어진다 — 숫자만 붉어지면 눈이 그쪽에 없을 때 놓친다
    if (state.phase === 'penalty') {
      const vignette = c.createRadialGradient(360, 640, 260, 360, 640, 800)
      vignette.addColorStop(0, 'rgb(239 83 80 / 0)')
      vignette.addColorStop(1, 'rgb(239 83 80 / 0.34)')
      c.fillStyle = vignette
      c.fillRect(0, 0, 720, 1280)
    }

    // HUD: 점수 + 단계 + 하트 (공통 점수판 규격)
    drawScorePanel(c, {
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.font = font(20)
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('fn.level', { n: state.level }), SCORE_PANEL.cx, SCORE_PANEL.subY)
    drawIconRow(c, 'heart', SCORE_PANEL.cx, 190, 14, state.hearts, Math.max(3, state.hearts))
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return {
    destroy: () => shell.destroy(),
    getScore: () => state.score,
    // 관리자 전용 '다음 단계' — clear는 저절로 다음 단계로 넘어가는 중이라 받지 않는다(두 번 넘어간다).
    adminSkip() {
      if (state.phase === 'over' || state.phase === 'clear') return
      state.level += 1
      startLevel(state)
    },
  }
}

export default defineGame(createSession)
