import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { BAR_MAX, SEG_H, branchAt, climb, createState, reviveBelow, update } from './state'
import { font } from '../ui'

const STALK_W = 152
const STALK_X = 360 - STALK_W / 2
const PLAYER_Y = 860 // 지금 마디가 놓이는 화면 높이

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
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'bm.ad',
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
    const rewarded = await ctx.showRewardAd('bamboo-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveBelow(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const result = climb(state, p.x < 360 ? -1 : 1)
      if (result === 'up') {
        playDrop()
      } else if (result === 'hit') {
        playMerge(1)
        vibrate(90)
      }
    },
    onMove() {},
    onUp() {},
  })

  const segY = (index: number) => PLAYER_Y - (index - state.scroll) * SEG_H

  const drawBranch = (y: number, side: number) => {
    const c = stage.c
    const rootX = side === -1 ? STALK_X + 8 : STALK_X + STALK_W - 8
    const tipX = rootX + side * 150
    c.strokeStyle = '#33691E'
    c.lineWidth = 13
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(rootX, y)
    c.quadraticCurveTo(rootX + side * 80, y - 26, tipX, y - 6)
    c.stroke()
    // 잎 세 장
    c.fillStyle = '#558B2F'
    for (let i = 0; i < 3; i++) {
      const t2 = 0.45 + i * 0.24
      const lx = rootX + side * 150 * t2
      const ly = y - 20 * Math.sin(t2 * Math.PI) - 4
      c.save()
      c.translate(lx, ly)
      c.rotate(side * (-0.5 - i * 0.25))
      c.beginPath()
      c.ellipse(0, -16, 11, 30, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  // 캐릭터: 대나무를 붙잡은 판다. 붙은 쪽에 따라 좌우가 뒤집힌다.
  const drawClimber = (y: number, side: number) => {
    const c = stage.c
    const x = side === -1 ? STALK_X - 30 : STALK_X + STALK_W + 30
    c.save()
    c.translate(x, y)
    c.scale(side === -1 ? 1 : -1, 1)
    // 귀
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.arc(-16, -34, 13, 0, Math.PI * 2)
    c.arc(16, -34, 13, 0, Math.PI * 2)
    c.fill()
    // 몸
    c.fillStyle = '#F5F5F5'
    c.beginPath()
    c.arc(0, 0, 38, 0, Math.PI * 2)
    c.fill()
    // 팔 (줄기 쪽으로)
    c.strokeStyle = '#2E2E2E'
    c.lineWidth = 15
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(16, -6)
    c.lineTo(44, -18)
    c.moveTo(14, 16)
    c.lineTo(42, 24)
    c.stroke()
    // 눈 무늬와 눈
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.ellipse(-13, -8, 9, 11, -0.3, 0, Math.PI * 2)
    c.ellipse(13, -8, 9, 11, 0.3, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(-12, -9, 3.6, 0, Math.PI * 2)
    c.arc(14, -9, 3.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.arc(0, 8, 5, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#0F2417', '#16351F')

    // 뒤로 흐르는 대나무 숲
    c.fillStyle = 'rgb(255 255 255 / 0.03)'
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 160
      c.fillRect(x, 0, 46, 1280)
    }

    // 줄기
    c.fillStyle = '#7CB342'
    c.fillRect(STALK_X, 0, STALK_W, 1280)
    c.fillStyle = 'rgb(255 255 255 / 0.16)'
    c.fillRect(STALK_X + 14, 0, 26, 1280)
    c.fillStyle = 'rgb(0 0 0 / 0.12)'
    c.fillRect(STALK_X + STALK_W - 26, 0, 26, 1280)

    // 마디 선 + 가지
    const from = Math.floor(state.scroll) - 3
    const to = Math.floor(state.scroll) + 10
    for (let i = from; i <= to; i++) {
      if (i < 0) continue
      const y = segY(i)
      c.fillStyle = '#558B2F'
      c.fillRect(STALK_X, y + SEG_H / 2 - 5, STALK_W, 10)
      const branch = branchAt(state, i)
      if (branch !== 0) drawBranch(y, branch)
    }

    drawClimber(segY(state.height), state.side)

    if (state.hitFlash > 0) {
      c.save()
      c.globalAlpha = state.hitFlash
      c.fillStyle = '#EF5350'
      c.fillRect(0, 0, 720, 1280)
      c.restore()
    }

    // 시간 막대 — 쉬는 동안 계속 줄어드는 것이 이 게임의 압박이다
    const ratio = state.timeBar / BAR_MAX
    c.fillStyle = 'rgb(0 0 0 / 0.3)'
    c.beginPath()
    c.roundRect(60, 150, 600, 30, 15)
    c.fill()
    c.fillStyle = ratio < 0.25 ? '#EF5350' : ratio < 0.5 ? '#FFB300' : '#8BC34A'
    c.beginPath()
    c.roundRect(60, 150, Math.max(8, 600 * ratio), 30, 15)
    c.fill()

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#FFFFFF'
    c.font = font(52, true)
    c.fillText(state.score.toLocaleString(), 360, 92)
    c.font = font(20)
    c.fillStyle = 'rgb(255 255 255 / 0.55)'
    c.fillText(t('bm.height', { n: state.height }), 360, 130)

    if (state.height < 3 && state.phase === 'playing') {
      c.fillStyle = 'rgb(255 255 255 / 0.6)'
      c.font = font(24)
      c.fillText(t('bm.hint'), 360, 1200)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
