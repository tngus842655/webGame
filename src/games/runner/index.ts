import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  AIR_BAR_TOP,
  GROUND_Y,
  JUMP_V,
  PLAYER_H,
  PLAYER_W,
  PLAYER_X,
  createState,
  scoreOf,
  update,
} from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.coinsTaken > 0) playMerge(2)
      if (result.died) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'run.ad',
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

  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('runner_continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.obstacles = []
    state.playerY = GROUND_Y
    state.vy = 0
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      if (state.phase !== 'playing' || state.jumpsLeft <= 0) return
      state.vy = JUMP_V
      state.jumpsLeft -= 1
      playDrop()
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#9FD3E8', '#E1F5FE')
    const scroll = state.distance

    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, GROUND_Y)
    sky.addColorStop(0, '#8ED8F8')
    sky.addColorStop(1, '#D6F0FB')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, GROUND_Y)

    // 구름 (느린 시차)
    c.save()
    c.fillStyle = 'rgb(255 255 255 / 0.85)'
    for (const [ox, oy, os] of [[0, 200, 1], [300, 320, 0.8], [560, 150, 0.9]] as Array<[number, number, number]>) {
      const cx = ((ox - scroll * 0.08) % 1000 + 1000) % 1000 - 140
      c.beginPath()
      c.arc(cx, oy, 34 * os, 0, Math.PI * 2)
      c.arc(cx + 38 * os, oy - 12 * os, 44 * os, 0, Math.PI * 2)
      c.arc(cx + 82 * os, oy, 32 * os, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()

    // 뒷산 (중간 시차)
    c.save()
    c.fillStyle = '#A5D6A7'
    for (let i = -1; i < 4; i++) {
      const hx = ((i * 320 - scroll * 0.25) % 1280 + 1280) % 1280 - 320
      c.beginPath()
      c.moveTo(hx - 160, GROUND_Y)
      c.quadraticCurveTo(hx, GROUND_Y - 220, hx + 160, GROUND_Y)
      c.closePath()
      c.fill()
    }
    c.restore()

    // 땅
    c.fillStyle = '#8D6E63'
    c.fillRect(0, GROUND_Y, 720, 1280 - GROUND_Y)
    c.fillStyle = '#7CB342'
    c.fillRect(0, GROUND_Y, 720, 18)
    // 땅 질감 (스크롤)
    c.save()
    c.fillStyle = 'rgb(0 0 0 / 0.08)'
    for (let i = 0; i < 10; i++) {
      const gx = ((i * 90 - scroll) % 900 + 900) % 900 - 90
      c.fillRect(gx, GROUND_Y + 40, 46, 10)
      c.fillRect(gx + 30, GROUND_Y + 110, 60, 10)
    }
    c.restore()

    // 장애물
    for (const o of state.obstacles) {
      if (o.air) {
        // 공중 가시 막대
        c.save()
        c.fillStyle = '#E65100'
        c.beginPath()
        c.roundRect(o.x, AIR_BAR_TOP + 4, o.w, o.h, 10)
        c.fill()
        const grad = c.createLinearGradient(o.x, AIR_BAR_TOP, o.x, AIR_BAR_TOP + o.h)
        grad.addColorStop(0, '#FFB74D')
        grad.addColorStop(1, '#F57C00')
        c.fillStyle = grad
        c.beginPath()
        c.roundRect(o.x, AIR_BAR_TOP, o.w, o.h, 10)
        c.fill()
        // 경고 줄무늬
        c.save()
        c.beginPath()
        c.roundRect(o.x, AIR_BAR_TOP, o.w, o.h, 10)
        c.clip()
        c.strokeStyle = 'rgb(62 39 35 / 0.35)'
        c.lineWidth = 9
        for (let sx = -o.h; sx < o.w + o.h; sx += 26) {
          c.beginPath()
          c.moveTo(o.x + sx, AIR_BAR_TOP + o.h)
          c.lineTo(o.x + sx + o.h, AIR_BAR_TOP)
          c.stroke()
        }
        c.restore()
        c.restore()
      } else {
        // 바위
        c.save()
        c.fillStyle = '#4E7C3F'
        c.beginPath()
        c.roundRect(o.x, GROUND_Y - o.h + 6, o.w, o.h, 12)
        c.fill()
        const grad = c.createLinearGradient(o.x, GROUND_Y - o.h, o.x, GROUND_Y)
        grad.addColorStop(0, '#8BC34A')
        grad.addColorStop(1, '#5B9033')
        c.fillStyle = grad
        c.beginPath()
        c.roundRect(o.x, GROUND_Y - o.h, o.w, o.h, 12)
        c.fill()
        c.restore()
      }
    }

    // 코인 (회전 느낌)
    for (const coin of state.coins) {
      const spin = Math.abs(Math.cos(scroll * 0.02 + coin.x * 0.02))
      c.save()
      c.fillStyle = '#F9A825'
      c.beginPath()
      c.ellipse(coin.x, coin.y, 18 * spin + 3, 18, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFD54F'
      c.beginPath()
      c.ellipse(coin.x, coin.y, 13 * spin + 2, 13, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    // 플레이어
    const top = state.playerY - PLAYER_H
    const airborne = state.playerY < GROUND_Y - 1
    const legPhase = Math.sin(scroll * 0.06)
    c.save()
    // 그림자
    c.fillStyle = 'rgb(0 0 0 / 0.15)'
    c.beginPath()
    c.ellipse(PLAYER_X, GROUND_Y + 6, PLAYER_W * 0.5, 8, 0, 0, Math.PI * 2)
    c.fill()
    // 다리
    c.strokeStyle = '#3E2723'
    c.lineWidth = 8
    c.lineCap = 'round'
    for (const dir of [-1, 1]) {
      c.beginPath()
      c.moveTo(PLAYER_X + dir * 12, state.playerY - 12)
      if (airborne) c.lineTo(PLAYER_X + dir * 20, state.playerY - 2)
      else c.lineTo(PLAYER_X + dir * 12 + legPhase * dir * 14, state.playerY + 2)
      c.stroke()
    }
    // 몸통
    const body = c.createLinearGradient(PLAYER_X, top, PLAYER_X, state.playerY)
    body.addColorStop(0, '#FFAB91')
    body.addColorStop(1, '#F4511E')
    c.fillStyle = body
    c.beginPath()
    c.roundRect(PLAYER_X - PLAYER_W / 2, top, PLAYER_W, PLAYER_H - 8, 16)
    c.fill()
    // 얼굴
    c.fillStyle = '#3E2723'
    c.beginPath()
    c.ellipse(PLAYER_X + 6, top + 22, 4.5, 6, 0, 0, Math.PI * 2)
    c.ellipse(PLAYER_X + 20, top + 22, 4.5, 6, 0, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#3E2723'
    c.lineWidth = 3
    c.beginPath()
    c.arc(PLAYER_X + 13, top + 34, 8, 0.15 * Math.PI, 0.85 * Math.PI)
    c.stroke()
    c.restore()

    // HUD
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.8
    c.beginPath()
    c.roundRect(240, 34, 240, 88, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#0D47A1'
    c.font = 'bold 52px sans-serif'
    c.fillText(scoreOf(state).toLocaleString(), 360, 96)

    // 텍스트 없는 조작 안내: 위로 튀는 탭 표식
    if (state.time < 4 && state.phase === 'playing') {
      const k = (state.time % 1.2) / 1.2
      const lift = Math.sin(k * Math.PI) * 40
      c.save()
      c.globalAlpha = 0.55
      c.fillStyle = '#0D47A1'
      c.beginPath()
      c.arc(360, 620 - lift, 18, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.3
      c.beginPath()
      c.arc(360, 620 - lift, 30 + lift * 0.3, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => scoreOf(state) }
}

export default defineGame(createSession)
