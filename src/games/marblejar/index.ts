import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  CAP,
  COLORS,
  HOLD_SLOTS,
  JARS,
  createState,
  reviveForAd,
  isMixed,
  place,
  remainingByColor,
  useHold,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

const JAR_W = 112
const JAR_GAP = 25
const JAR_X0 = 30
const SLOT_H = 70
const JAR_TOP = 620
const JAR_H = CAP * SLOT_H + 20
const JAR_BOTTOM = JAR_TOP + JAR_H
const MARBLE_R = 30

const BAG_Y = 206
const HAND_Y = 340
const HAND_R = 46
const NEXT_X = 556
const NEXT_R = 26
const HINT_Y = 416
const HOLD_Y = 486
const HOLD_R = 34
const HOLD_GAP = 140
const GRAVITY = 22000 // px/s² — 낙하 연출의 가속도

const jarX = (index: number) => JAR_X0 + index * (JAR_W + JAR_GAP)
const slotY = (slot: number) => JAR_BOTTOM - 12 - MARBLE_R - slot * SLOT_H
const holdX = (slot: number) => 360 - ((HOLD_SLOTS - 1) * HOLD_GAP) / 2 + slot * HOLD_GAP

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    tickVisuals(dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'gameover', 'tap', 'select', 'unlock')
  let adEmptyUsed = false

  // 손에서 통까지 떨어지는 구슬. 규칙은 탭 즉시 반영되고 이 연출만 뒤따르므로
  // 아무리 빨리 눌러도 입력이 밀리지 않는다. 비워지는 번쩍임과 소리는 도착에 맞춘다.
  interface Flight {
    color: number
    jar: number
    slot: number
    cleared: boolean
    x1: number
    y1: number
    t: number
    dur: number
  }
  const flights: Flight[] = []
  let clearFlash: { jar: number; t: number } | null = null
  let rejectFlash: { jar: number; t: number } | null = null

  const launch = (color: number, jar: number, slot: number, cleared: boolean) => {
    const y1 = slotY(slot)
    flights.push({
      color,
      jar,
      slot,
      cleared,
      x1: jarX(jar) + JAR_W / 2,
      y1,
      t: 0,
      // 떨어지는 시간을 거리에서 뽑는다 — 아래 칸일수록 조금 더 오래 걸린다
      dur: Math.sqrt((2 * (y1 - HAND_Y)) / GRAVITY),
    })
  }

  const land = (f: Flight) => {
    if (f.cleared) {
      clearFlash = { jar: f.jar, t: 0.6 }
      playSfx('clear')
      vibrate([15, 35, 25])
    } else {
      playDrop()
    }
  }

  const tickVisuals = (dt: number) => {
    if (clearFlash) {
      clearFlash.t -= dt
      if (clearFlash.t <= 0) clearFlash = null
    }
    if (rejectFlash) {
      rejectFlash.t -= dt
      if (rejectFlash.t <= 0) rejectFlash = null
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      f.t += dt
      if (f.t < f.dur) continue
      flights.splice(i, 1)
      land(f)
    }
  }

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'mj.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adEmptyUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adEmptyUsed) return
    const rewarded = await ctx.showRewardAd('marblejar-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adEmptyUsed = true
    reviveForAd(state)
    playSfx('unlock')
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adEmptyUsed, 'over.byStuck')
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)

      // 임시 자리가 통보다 위에 있으므로 먼저 받는다
      if (p.y >= HOLD_Y - 54 && p.y <= HOLD_Y + 54) {
        for (let i = 0; i < HOLD_SLOTS; i++) {
          const x = holdX(i)
          if (p.x < x - 62 || p.x > x + 62) continue
          if (useHold(state, i)) {
            playSfx('select')
            vibrate(12)
          }
          return
        }
        return
      }

      // 통 위아래로 넉넉하게 눌러도 들어가도록 띠 전체를 받는다
      if (p.y < JAR_TOP - 45 || p.y > JAR_BOTTOM + 90) return
      for (let i = 0; i < JARS; i++) {
        const x = jarX(i)
        if (p.x < x - 11 || p.x > x + JAR_W + 11) continue
        const slot = state.jars[i].length // 넣기 전 길이 = 이 구슬이 앉을 칸
        const color = state.marble
        const result = place(state, i)
        if (result === 'rejected') {
          rejectFlash = { jar: i, t: 0.3 }
          vibrate(40)
        } else if (result === 'cleared') {
          // 방금 비워진 통으로 아직 날아가던 구슬은 앉을 자리가 없어졌다
          for (let k = flights.length - 1; k >= 0; k--) if (flights[k].jar === i) flights.splice(k, 1)
          launch(color, i, slot, true)
        } else if (result) {
          launch(color, i, slot, false)
        }
        return
      }
    },
    onMove() {},
    onUp() {},
  })

  // 납작한 원 + 검은 테두리였던 것을 유리구슬로 — 위에서 빛을 받고
  // 아래쪽에 반사광이 도는 공. 색만으로 갈리던 것이 형태로도 읽힌다.
  const drawMarble = (x: number, y: number, color: number, r = MARBLE_R) => {
    const c = stage.c
    const ball = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05)
    ball.addColorStop(0, 'rgb(255 255 255 / 0.85)')
    ball.addColorStop(0.28, COLORS[color])
    ball.addColorStop(1, 'rgb(0 0 0 / 0.35)')
    c.fillStyle = COLORS[color]
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = ball
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
    // 바닥에서 올라오는 반사광
    c.fillStyle = 'rgb(255 255 255 / 0.22)'
    c.beginPath()
    c.ellipse(x, y + r * 0.52, r * 0.5, r * 0.2, 0, 0, Math.PI * 2)
    c.fill()
    // 하이라이트
    c.fillStyle = 'rgb(255 255 255 / 0.9)'
    c.beginPath()
    c.ellipse(x - r * 0.33, y - r * 0.38, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.16)'
    c.lineWidth = 1.5
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
    c.save()
    c.globalAlpha = 0.45
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.ellipse(x - r * 0.3, y - r * 0.34, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  // 가로는 빨리 붙고 천천히 멎게, 세로는 중력처럼 점점 빨라지게.
  // 크기가 손에 든 것(HAND_R)에서 통 안 것(MARBLE_R)으로 줄어 같은 구슬로 읽힌다.
  const drawFlight = (f: Flight) => {
    const p = Math.min(1, f.t / f.dur)
    const x = 360 + (f.x1 - 360) * (1 - (1 - p) ** 2)
    const y = HAND_Y + (f.y1 - HAND_Y) * p * p
    drawMarble(x, y, f.color, HAND_R + (MARBLE_R - HAND_R) * p)
  }

  // 이번 가방에 남은 색별 개수 — 무엇이 아직 안 나왔는지 세어 계획할 수 있게 한다
  const drawBag = () => {
    const c = stage.c
    const left = remainingByColor(state)
    const x0 = 360 - ((state.colors - 1) * 70) / 2
    c.textAlign = 'center'
    for (let i = 0; i < state.colors; i++) {
      const x = x0 + i * 70
      const n = left[i]
      c.save()
      if (n === 0) c.globalAlpha = 0.25
      drawMarble(x, BAG_Y, i, 15)
      c.restore()
      c.fillStyle = n === 0 ? 'rgb(255 255 255 / 0.25)' : 'rgb(255 255 255 / 0.72)'
      c.font = font(19, n > 0)
      c.fillText(String(n), x, BAG_Y + 38)
    }
  }

  // 임시 자리 — 빈 칸은 점선 테두리로 '넣을 수 있는 곳'임을 알린다
  const drawHold = () => {
    const c = stage.c
    for (let i = 0; i < HOLD_SLOTS; i++) {
      const x = holdX(i)
      const kept = state.hold[i]
      if (kept === null) {
        c.save()
        c.setLineDash([7, 7])
        c.strokeStyle = 'rgb(255 255 255 / 0.3)'
        c.lineWidth = 2.5
        c.beginPath()
        c.arc(x, HOLD_Y, HOLD_R, 0, Math.PI * 2)
        c.stroke()
        c.restore()
      } else {
        c.fillStyle = 'rgb(255 255 255 / 0.08)'
        c.beginPath()
        c.arc(x, HOLD_Y, HOLD_R + 7, 0, Math.PI * 2)
        c.fill()
        drawMarble(x, HOLD_Y, kept, HOLD_R)
      }
    }
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.4)'
    c.font = font(19)
    c.fillText(t('mj.hold'), 360, HOLD_Y + HOLD_R + 30)
  }

  const draw = () => {
    const c = stage.begin('#241C17', '#332720')

    drawBag()

    // 손에 든 구슬과 다음 구슬
    drawMarble(360, HAND_Y, state.marble, HAND_R)
    drawMarble(NEXT_X, HAND_Y - 6, state.next, NEXT_R)
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.4)'
    c.font = font(19)
    c.fillText(t('mj.next'), NEXT_X, HAND_Y + 40)

    c.fillStyle = 'rgb(255 255 255 / 0.45)'
    c.font = font(22)
    c.fillText(t('mj.hint'), 360, HINT_Y)

    drawHold()

    for (let i = 0; i < JARS; i++) {
      const x = jarX(i)
      const jar = state.jars[i]
      const mixed = isMixed(jar)
      // 넣으면 바로 비워지는 통은 금색으로 알려 준다
      const completes = jar.length === CAP - 1 && !mixed && jar[0] === state.marble
      const flashing = clearFlash?.jar === i
      const rejecting = rejectFlash?.jar === i

      c.beginPath()
      c.roundRect(x, JAR_TOP, JAR_W, JAR_H, 20)
      c.fillStyle = mixed ? 'rgb(255 255 255 / 0.05)' : 'rgb(255 255 255 / 0.1)'
      c.fill()
      c.lineWidth = flashing || completes || rejecting ? 5 : 3
      c.strokeStyle = rejecting
        ? '#EF5350'
        : flashing
          ? '#FFECB3'
          : completes
            ? '#FFD54F'
            : mixed
              ? 'rgb(255 255 255 / 0.12)'
              : 'rgb(255 255 255 / 0.28)'
      c.stroke()

      // 칸 눈금
      c.strokeStyle = 'rgb(255 255 255 / 0.07)'
      c.lineWidth = 2
      for (let s = 1; s < CAP; s++) {
        const y = JAR_BOTTOM - 12 - s * SLOT_H + SLOT_H / 2 - MARBLE_R
        c.beginPath()
        c.moveTo(x + 12, y)
        c.lineTo(x + JAR_W - 12, y)
        c.stroke()
      }

      for (let s = 0; s < jar.length; s++) {
        if (flights.some((f) => f.jar === i && f.slot === s)) continue
        drawMarble(x + JAR_W / 2, slotY(s), jar[s])
      }

      // 날아오는 구슬은 이 통의 그늘보다 먼저 그려야 도착할 때 밝기가 튀지 않는다
      for (const f of flights) if (f.jar === i) drawFlight(f)

      // 섞인 통은 다시 비워지지 않는다 — 흐릿하게 표시해 알려 준다
      if (mixed) {
        c.save()
        c.globalAlpha = 0.42
        c.fillStyle = '#241C17'
        c.beginPath()
        c.roundRect(x, JAR_TOP, JAR_W, JAR_H, 20)
        c.fill()
        c.restore()
      }
    }

    // HUD
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.textAlign = 'center'
    c.font = font(22)
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('mj.colors', { n: state.colors }), SCORE_PANEL.cx, SCORE_PANEL.subY)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
