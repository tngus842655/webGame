import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { SLOTS, clearBlockingSlot, createState, legalSlots, place, update } from './state'

const SLOT_X = 56
const SLOT_W = 372
const SLOT_TOP = 158
const SLOT_H = 56
const PITCH = 62
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
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adClearUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'nm.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adClearUsed = false
      Object.assign(state, createState())
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
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adClearUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (p.x < SLOT_X || p.x > SLOT_X + SLOT_W) return
      const index = Math.floor((p.y - SLOT_TOP) / PITCH)
      if (index < 0 || index >= SLOTS) return
      if (p.y > slotY(index) + SLOT_H) return // 칸 사이 여백
      const result = place(state, index)
      if (result === 'rejected') {
        vibrate(40)
      } else if (result === 'cleared') {
        playMerge(6)
        vibrate([20, 40, 30])
      } else if (result) {
        playDrop()
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#101A2B', '#17233B')
    const legal = legalSlots(state)

    for (let i = 0; i < SLOTS; i++) {
      const y = slotY(i)
      const value = state.slots[i]
      const focused = state.focusSlot === i && state.focusTimer > 0
      const rejected = state.rejectSlot === i && state.rejectTimer > 0

      c.beginPath()
      c.roundRect(SLOT_X, y, SLOT_W, SLOT_H, 12)
      c.fillStyle = value !== null ? '#37507A' : legal[i] ? 'rgb(102 187 106 / 0.14)' : 'rgb(255 255 255 / 0.04)'
      c.fill()
      // 넣을 수 있는 칸만 테두리를 살린다 — 규칙을 글로 설명하지 않아도 되도록
      c.lineWidth = rejected || focused || legal[i] ? 3 : 2
      c.strokeStyle = rejected
        ? '#EF5350'
        : focused
          ? '#FFD54F'
          : value !== null
            ? 'rgb(255 255 255 / 0.14)'
            : legal[i]
              ? '#66BB6A'
              : 'rgb(255 255 255 / 0.07)'
      c.stroke()

      if (value !== null) {
        c.fillStyle = '#FFFFFF'
        c.font = 'bold 32px sans-serif'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(String(value), SLOT_X + SLOT_W / 2, y + SLOT_H / 2 + 1)
      }
    }
    c.textBaseline = 'alphabetic'

    const cx = CARD_X + CARD_W / 2
    c.textAlign = 'center'

    // 판 수
    c.fillStyle = 'rgb(255 255 255 / 0.45)'
    c.font = '22px sans-serif'
    c.fillText(t('nm.round', { n: state.round }), cx, 250)

    // 위는 작게 아래는 크게 — 규칙을 글자 없이 알려 주는 쐐기
    c.fillStyle = 'rgb(255 255 255 / 0.09)'
    c.beginPath()
    c.moveTo(cx - 7, 300)
    c.lineTo(cx + 7, 300)
    c.lineTo(cx + 34, 462)
    c.lineTo(cx - 34, 462)
    c.closePath()
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.3)'
    c.font = '20px sans-serif'
    c.fillText('1', cx, 292)
    c.font = '26px sans-serif'
    c.fillText('999', cx, 494)

    // 손에 든 카드
    c.beginPath()
    c.roundRect(CARD_X, 540, CARD_W, 152, 18)
    c.fillStyle = '#FFF8E1'
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.2)'
    c.lineWidth = 3
    c.stroke()
    c.fillStyle = '#3E2723'
    c.font = 'bold 62px sans-serif'
    c.fillText(String(state.card), cx, 638)

    if (state.clearFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, state.clearFlash / 0.4)
      c.fillStyle = 'rgb(0 0 0 / 0.6)'
      c.fillRect(0, 742, 720, 120)
      c.fillStyle = '#FFD54F'
      c.font = 'bold 40px sans-serif'
      c.fillText(t('nm.clear', { n: state.clearGain }), 360, 818)
      c.restore()
    }

    // HUD
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(200, 18, 320, 118, 22)
    c.fill()
    c.restore()
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 50)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 44px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 106)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
