import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  createState,
  meters,
  releaseJump,
  setAim,
  startCharge,
  step,
  PLAYER_HALF,
  type Platform,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconValue } from '../icons'

// 고도에 따라 하늘색이 어두워진다
const SKY_LOW = [142, 208, 245]
const SKY_HIGH = [26, 35, 66]

function lerpColor(a: number[], b: number[], k: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

// 밴드 인덱스로 만드는 고정 의사난수 (장식용 구름·별 배치)
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = step(state, dt)
    if (events.jumped) playSfx('whoosh')
    if (events.landed) {
      playSfx('impact', { gain: 0.7 })
      vibrate(10)
    }
    if (events.bounced) vibrate(10)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'impact', 'tap', 'whoosh')
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'jc.ad',
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

  // 광고 보상: 60초를 더 받고 그 자리에서 이어서 오른다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('jump-time')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.timeLeft = 60
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = meters(state.maxHeight)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 터치가 캐릭터에서 좌우로 멀수록 수평 성분이 커진다 (같은 열이면 수직 점프)
      startCharge(state, Math.max(-1, Math.min(1, (p.x - state.x) / 300)))
    },
    onMove(clientX, clientY) {
      if (!state.charging) return
      const p = stage.toBoard(clientX, clientY)
      setAim(state, (p.x - state.x) / 300)
    },
    onUp() {
      if (releaseJump(state)) playDrop()
    },
  })

  // 월드 → 화면 좌표
  const sy = (worldY: number) => 640 + (state.camY - worldY)

  const drawPlatform = (c: CanvasRenderingContext2D, p: Platform) => {
    const y = sy(p.y)
    if (y < -60 || y > 1340) return
    const left = p.x - p.w / 2
    if (p.y === 0) {
      // 지면: 화면 바닥까지 흙으로 채운다
      c.fillStyle = '#5D4037'
      c.fillRect(0, y, 720, Math.max(0, 1280 - y) + 60)
      c.fillStyle = '#66BB6A'
      c.fillRect(0, y - 6, 720, 16)
      return
    }
    const top = p.y < 2000 ? '#66BB6A' : p.y < 5000 ? '#90A4AE' : '#B3E5FC'
    const body = p.y < 2000 ? '#8D6E63' : p.y < 5000 ? '#607D8B' : '#78909C'
    c.fillStyle = body
    c.beginPath()
    c.roundRect(left, y - 4, p.w, 22, 6)
    c.fill()
    c.fillStyle = top
    c.beginPath()
    c.roundRect(left, y - 6, p.w, 10, 5)
    c.fill()
  }

  const draw = () => {
    const altitude = Math.max(0, state.camY - 540)
    const k = Math.min(1, altitude / 9000)
    const c = stage.begin(lerpColor(SKY_LOW, SKY_HIGH, Math.min(1, k + 0.15)), lerpColor(SKY_LOW, SKY_HIGH, k))

    // 장식: 낮은 곳엔 구름, 높은 곳엔 별
    const bandTop = Math.floor((state.camY + 700) / 300)
    for (let b = Math.max(0, bandTop - 6); b <= bandTop; b++) {
      const wy = b * 300 + 150
      const y = sy(wy)
      if (y < -60 || y > 1340) continue
      const x = 60 + hash(b) * 600
      if (wy < 4500) {
        c.save()
        c.globalAlpha = 0.5
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.ellipse(x, y, 70 + hash(b + 0.5) * 40, 26, 0, 0, Math.PI * 2)
        c.ellipse(x + 50, y + 10, 45, 20, 0, 0, Math.PI * 2)
        c.fill()
        c.restore()
      } else {
        c.fillStyle = '#FFF9C4'
        for (let s = 0; s < 5; s++) {
          const sx = hash(b * 7 + s) * 700 + 10
          const syy = y + hash(b * 13 + s) * 280 - 140
          c.fillRect(sx, syy, 4, 4)
        }
      }
    }

    for (const p of state.platforms) drawPlatform(c, p)

    // 플레이어: 차지하면 움츠리고, 뛰는 중엔 늘어난다
    const px = state.x
    const py = sy(state.y)
    let scaleY = 1 - state.charge * 0.3
    if (!state.grounded) scaleY = state.vy > 200 ? 1.15 : state.vy < -200 ? 0.95 : 1
    const w = PLAYER_HALF * 2
    const h = 40 * scaleY
    c.fillStyle = '#FF7043'
    c.beginPath()
    c.roundRect(px - w / 2, py - h, w, h, 12)
    c.fill()
    // 눈 (점프 방향을 본다)
    const look = state.aim * 5
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(px - 8 + look, py - h * 0.62, 6.5, 0, Math.PI * 2)
    c.arc(px + 8 + look, py - h * 0.62, 6.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#37474F'
    c.beginPath()
    c.arc(px - 8 + look * 1.4, py - h * 0.62, 3, 0, Math.PI * 2)
    c.arc(px + 8 + look * 1.4, py - h * 0.62, 3, 0, Math.PI * 2)
    c.fill()

    // 차지 게이지 + 방향 화살표
    if (state.charging) {
      const gy = py - h - 26
      c.fillStyle = 'rgb(255 255 255 / 0.45)'
      c.beginPath()
      c.roundRect(px - 34, gy, 68, 12, 6)
      c.fill()
      c.fillStyle = state.charge > 0.75 ? '#EF5350' : state.charge > 0.4 ? '#FFA726' : '#66BB6A'
      c.beginPath()
      c.roundRect(px - 34, gy, Math.max(8, 68 * state.charge), 12, 6)
      c.fill()
      // 조준 화살표: 수평 성분만큼 기울어진다
      if (Math.abs(state.aim) > 0.08) {
        const dir = Math.sign(state.aim)
        const ax = px + dir * (40 + Math.abs(state.aim) * 24)
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.moveTo(ax, gy + 6)
        c.lineTo(ax - dir * 16, gy - 2)
        c.lineTo(ax - dir * 16, gy + 14)
        c.closePath()
        c.fill()
      }
    }

    // HUD: 최고 높이 + 현재 높이 + 남은 시간
    drawScorePanel(c, {
      label: t('hud.score'),
      value: `${meters(state.maxHeight)}m`,
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.92)',
      labelColor: '#90A4AE',
      valueColor: '#37474F',
    })
    c.font = font(24)
    c.fillStyle = '#78909C'
    c.textAlign = 'left'
    c.fillText(`${meters(state.y)}m`, SCORE_PANEL.left, SCORE_PANEL.subY)
    const low = state.timeLeft < 30
    c.fillStyle = low ? '#E53935' : '#78909C'
    const mm = Math.floor(state.timeLeft / 60)
    const ss = String(Math.floor(state.timeLeft % 60)).padStart(2, '0')
    drawIconValue(c, 'timer', `${mm}:${ss}`, SCORE_PANEL.right, SCORE_PANEL.subY - 8, 13, 'right', {
      color: low ? '#E53935' : '#78909C',
    })
    c.textAlign = 'center'
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  // 시간제한 게임 — 제한 시간을 다 쓴 결과만 기록한다
  return shell
}

export default defineGame(createSession)
