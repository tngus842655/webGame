import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { CAP, COLORS, JARS, createState, emptyFullestJar, isMixed, place, update } from './state'
import { font } from '../ui'

const JAR_W = 130
const JAR_GAP = 40
const JAR_X0 = 40
const SLOT_H = 76
const JAR_TOP = 620
const JAR_H = CAP * SLOT_H + 20
const JAR_BOTTOM = JAR_TOP + JAR_H
const MARBLE_R = 32

const jarX = (index: number) => JAR_X0 + index * (JAR_W + JAR_GAP)
const slotY = (slot: number) => JAR_BOTTOM - 14 - MARBLE_R - slot * SLOT_H

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
  let adEmptyUsed = false

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
    const rewarded = await ctx.showRewardAd('marblejar-empty')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adEmptyUsed = true
    emptyFullestJar(state)
    playMerge(4)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adEmptyUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 통 위아래로 넉넉하게 눌러도 들어가도록 띠 전체를 받는다
      if (p.y < JAR_TOP - 70 || p.y > JAR_BOTTOM + 80) return
      for (let i = 0; i < JARS; i++) {
        const x = jarX(i)
        if (p.x < x - 18 || p.x > x + JAR_W + 18) continue
        const result = place(state, i)
        if (result === 'cleared') {
          playMerge(6)
          vibrate([15, 35, 25])
        } else if (result === 'rejected') {
          vibrate(40)
        } else if (result) {
          playDrop()
        }
        return
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawMarble = (x: number, y: number, color: number, r = MARBLE_R) => {
    const c = stage.c
    c.fillStyle = COLORS[color]
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.2)'
    c.lineWidth = 2
    c.stroke()
    c.save()
    c.globalAlpha = 0.45
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.ellipse(x - r * 0.3, y - r * 0.34, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#241C17', '#332720')

    // 들고 있는 구슬
    drawMarble(360, 380, state.marble, 46)
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.45)'
    c.font = font(22)
    c.fillText(t('mj.hint'), 360, 484)

    for (let i = 0; i < JARS; i++) {
      const x = jarX(i)
      const jar = state.jars[i]
      const mixed = isMixed(jar)
      // 넣으면 바로 비워지는 통은 금색으로 알려 준다
      const completes = jar.length === CAP - 1 && !mixed && jar[0] === state.marble
      const flashing = state.clearFlash?.jar === i
      const rejecting = state.rejectFlash?.jar === i

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
        const y = JAR_BOTTOM - 14 - s * SLOT_H + SLOT_H / 2 - MARBLE_R
        c.beginPath()
        c.moveTo(x + 14, y)
        c.lineTo(x + JAR_W - 14, y)
        c.stroke()
      }

      for (let s = 0; s < jar.length; s++) drawMarble(x + JAR_W / 2, slotY(s), jar[s])

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
    c.fillStyle = '#FFFFFF'
    c.font = font(46, true)
    c.fillText(state.score.toLocaleString(), 360, 74)
    c.font = font(22)
    c.fillStyle = 'rgb(255 255 255 / 0.55)'
    c.fillText(t('mj.colors', { n: state.colors }), 360, 116)

    // 나올 수 있는 색을 늘어놓는다 — 통 수보다 많다는 것이 한눈에 보여야 한다
    const paletteX = 360 - ((state.colors - 1) * 46) / 2
    for (let i = 0; i < state.colors; i++) drawMarble(paletteX + i * 46, 168, i, 15)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
