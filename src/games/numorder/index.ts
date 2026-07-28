import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { SLOTS, clearBlockingSlot, createState, legalSlots, place, update } from './state'
import { drawScorePanel, font } from '../ui'

// 칸 높이는 손가락 과녁이다. 16칸을 세로로 다 세워야 해서 넉넉히는 못 잡지만,
// 칸 사이 여백까지 판정에 넣어 누를 곳이 끊기지 않게 한다.
const SLOT_X = 48
const SLOT_W = 384
const SLOT_TOP = 168
const SLOT_H = 62
const PITCH = 68
const TAP_X0 = 16 // 판정은 그림보다 넓게 — 왼쪽 가장자리까지 받는다
const TAP_X1 = 452
const CARD_X = 470
const CARD_W = 212

const slotY = (index: number) => SLOT_TOP + index * PITCH

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 4.2)
      if (fly.t >= 1) fly = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'fail', 'gameover', 'merge', 'tap')
  // 놓은 카드가 칸으로 날아간다 — 어디에 들어갔는지 눈이 따라가게
  let fly: { value: number; slot: number; t: number } | null = null
  let adClearUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'nm.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adClearUsed = false
      Object.assign(state, createState())
      fly = null
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adClearUsed) return
    const rewarded = await ctx.showRewardAd('numorder-clear-slot')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    if (!clearBlockingSlot(state)) return
    adClearUsed = true
    playMerge(3)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adClearUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (p.x < TAP_X0 || p.x > TAP_X1) return
      const index = Math.floor((p.y - SLOT_TOP) / PITCH)
      if (index < 0 || index >= SLOTS) return
      const card = state.card
      const result = place(state, index)
      if (result === 'rejected') {
        // 왜 안 되는지는 테두리가 말해준다 — 소리도 같이 짚어 준다
        playSfx('fail')
        vibrate(40)
      } else if (result === 'cleared') {
        playSfx('clear')
        vibrate([20, 40, 30])
        fly = { value: card, slot: index, t: 0 }
      } else if (result) {
        playDrop()
        fly = { value: card, slot: index, t: 0 }
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#101A2B', '#17233B')
    const legal = legalSlots(state)
    const cx = CARD_X + CARD_W / 2

    for (let i = 0; i < SLOTS; i++) {
      const y = slotY(i)
      const value = state.slots[i]
      const focused = state.focusSlot === i && state.focusTimer > 0
      const rejected = state.rejectSlot === i && state.rejectTimer > 0
      // 못 넣는 칸을 눌렀을 때 그 칸이 좌우로 흔들린다
      const shake = rejected ? Math.sin(state.rejectTimer * 60) * 8 * state.rejectTimer : 0

      c.save()
      c.translate(shake, 0)
      c.beginPath()
      c.roundRect(SLOT_X, y, SLOT_W, SLOT_H, 14)
      c.fillStyle =
        value !== null ? '#3B5583' : legal[i] ? 'rgb(102 187 106 / 0.2)' : 'rgb(255 255 255 / 0.05)'
      c.fill()
      // 넣을 수 있는 칸만 테두리를 살린다 — 규칙을 글로 설명하지 않아도 되도록
      c.lineWidth = rejected || focused || legal[i] ? 4 : 2
      c.strokeStyle = rejected
        ? '#EF5350'
        : focused
          ? '#FFD54F'
          : value !== null
            ? 'rgb(255 255 255 / 0.18)'
            : legal[i]
              ? '#6FCB73'
              : 'rgb(255 255 255 / 0.12)'
      c.stroke()

      if (value !== null && !(fly && fly.slot === i)) {
        c.fillStyle = '#FFFFFF'
        c.font = font(34, true)
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(String(value), SLOT_X + SLOT_W / 2, y + SLOT_H / 2 + 1)
      }
      // 방금 들어간 칸에서 빛이 번진다
      if (focused) {
        c.save()
        c.globalAlpha = Math.min(1, state.focusTimer / 0.4) * 0.5
        c.strokeStyle = '#FFD54F'
        c.lineWidth = 4
        c.beginPath()
        c.roundRect(SLOT_X - 6, y - 6, SLOT_W + 12, SLOT_H + 12, 18)
        c.stroke()
        c.restore()
      }
      c.restore()
    }
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'

    // 판 수
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = font(22)
    c.fillText(t('nm.round', { n: state.round }), cx, 250)

    // 위는 작게 아래는 크게 — 규칙을 글자 없이 알려 주는 쐐기
    c.fillStyle = 'rgb(255 255 255 / 0.1)'
    c.beginPath()
    c.moveTo(cx - 7, 300)
    c.lineTo(cx + 7, 300)
    c.lineTo(cx + 34, 462)
    c.lineTo(cx - 34, 462)
    c.closePath()
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.35)'
    c.font = font(20)
    c.fillText('1', cx, 292)
    c.font = font(26)
    c.fillText('999', cx, 494)

    // 손에 든 카드
    c.save()
    c.fillStyle = 'rgb(0 0 0 / 0.35)'
    c.beginPath()
    c.roundRect(CARD_X + 4, 546, CARD_W, 152, 18)
    c.fill()
    const paper = c.createLinearGradient(0, 540, 0, 692)
    paper.addColorStop(0, '#FFFDF3')
    paper.addColorStop(1, '#F1E4C4')
    c.fillStyle = paper
    c.beginPath()
    c.roundRect(CARD_X, 540, CARD_W, 152, 18)
    c.fill()
    c.strokeStyle = 'rgb(80 60 30 / 0.35)'
    c.lineWidth = 3
    c.stroke()
    c.restore()
    c.fillStyle = '#3E2723'
    c.font = font(62, true)
    c.fillText(String(state.card), cx, 638)

    // 카드가 칸으로 날아가는 중
    if (fly) {
      const e = 1 - (1 - fly.t) * (1 - fly.t)
      const x = cx + (SLOT_X + SLOT_W / 2 - cx) * e
      const y = 616 + (slotY(fly.slot) + SLOT_H / 2 - 616) * e
      c.save()
      c.globalAlpha = 1 - e * 0.25
      c.translate(x, y)
      c.scale(1 - e * 0.42, 1 - e * 0.42)
      c.fillStyle = '#FFFDF3'
      c.beginPath()
      c.roundRect(-CARD_W / 2, -76, CARD_W, 152, 18)
      c.fill()
      c.fillStyle = '#3E2723'
      c.font = font(62, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(fly.value), 0, 0)
      c.restore()
      c.textBaseline = 'alphabetic'
    }

    if (state.clearFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, state.clearFlash / 0.4)
      c.fillStyle = 'rgb(0 0 0 / 0.62)'
      c.fillRect(0, 742, 720, 120)
      c.fillStyle = '#FFD54F'
      c.font = font(40, true)
      c.textAlign = 'center'
      c.fillText(t('nm.clear', { n: state.clearGain }), 360, 818)
      c.restore()
    }

    // HUD
    drawScorePanel(c, { label: t('hud.score'), value: state.score.toLocaleString() })
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
