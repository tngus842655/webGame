import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { createState, tapLane, update, APPROACH, LANES, type Judge } from './state'

// 화면 배치 (논리 720×1280)
const LANE_X = 40
const LANE_W = 160
const HIT_Y = 1000
const BTN_Y = 1052
const BTN_H = 190
const NOTE_SPEED = (HIT_Y + 100) / APPROACH

const LANE_COLORS = ['#FF5A8C', '#FFC94D', '#4DD679', '#55B9FF']
const JUDGE_STYLE: Record<Judge, { text: string; color: string }> = {
  perfect: { text: 'PERFECT', color: '#FFD54F' },
  great: { text: 'GREAT', color: '#4DD679' },
  good: { text: 'GOOD', color: '#55B9FF' },
  miss: { text: 'MISS', color: '#FF5252' },
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    const misses = update(state, dt)
    if (misses.length > 0) {
      vibrate(40)
      effects.push({ lane: -1, judge: 'miss', age: 0 })
      if (state.phase === 'over') queueOver = true
    }
    if (queueOver && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) {
        queueOver = false
        void gameOver()
      }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].age += dt
      if (effects[i].age > 0.5) effects.splice(i, 1)
    }
    for (let i = 0; i < LANES; i++) press[i] = Math.max(0, press[i] - dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  const effects: Array<{ lane: number; judge: Judge; age: number }> = []
  const press = new Array<number>(LANES).fill(0)
  let queueOver = false
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'rt.ad',
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

  // 광고 보상: 체력을 회복하고 같은 곡을 이어서 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('rhythm-health')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.health = 60
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (p.y < HIT_Y - 200) return
      const lane = Math.floor((p.x - LANE_X) / LANE_W)
      if (lane < 0 || lane >= LANES) return
      press[lane] = 0.15
      const judge = tapLane(state, lane)
      if (judge) {
        playMerge(lane + 2)
        effects.push({ lane, judge, age: 0 })
      } else {
        playDrop()
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#0E0A1E', '#1A1130')

    // 레인 배경
    for (let i = 0; i < LANES; i++) {
      const x = LANE_X + i * LANE_W
      c.fillStyle = i % 2 === 0 ? 'rgb(255 255 255 / 0.045)' : 'rgb(255 255 255 / 0.075)'
      c.fillRect(x, 0, LANE_W, HIT_Y + 40)
      if (press[i] > 0) {
        c.save()
        c.globalAlpha = press[i] / 0.15 * 0.25
        c.fillStyle = LANE_COLORS[i]
        c.fillRect(x, 0, LANE_W, HIT_Y + 40)
        c.restore()
      }
    }

    // 판정선
    c.save()
    c.shadowColor = '#B39DDB'
    c.shadowBlur = 18
    c.strokeStyle = '#D1C4E9'
    c.lineWidth = 6
    c.beginPath()
    c.moveTo(LANE_X, HIT_Y)
    c.lineTo(LANE_X + LANE_W * LANES, HIT_Y)
    c.stroke()
    c.restore()

    // 노트
    for (const note of state.notes) {
      if (note.hit) continue
      const y = HIT_Y - (note.time - state.time) * NOTE_SPEED
      if (y < -50 || y > HIT_Y + 80) continue
      const x = LANE_X + note.lane * LANE_W
      c.fillStyle = LANE_COLORS[note.lane]
      c.beginPath()
      c.roundRect(x + 12, y - 18, LANE_W - 24, 36, 12)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.35)'
      c.beginPath()
      c.roundRect(x + 12, y - 18, LANE_W - 24, 12, 8)
      c.fill()
    }

    // 판정 이펙트
    for (const fx of effects) {
      const k = fx.age / 0.5
      const style = JUDGE_STYLE[fx.judge]
      c.save()
      c.globalAlpha = 1 - k
      if (fx.lane >= 0) {
        const cx = LANE_X + fx.lane * LANE_W + LANE_W / 2
        c.strokeStyle = style.color
        c.lineWidth = 5 * (1 - k)
        c.beginPath()
        c.arc(cx, HIT_Y, 30 + k * 70, 0, Math.PI * 2)
        c.stroke()
      }
      c.font = 'bold 44px sans-serif'
      c.textAlign = 'center'
      c.fillStyle = style.color
      c.fillText(style.text, 360, 700 - k * 40)
      c.restore()
    }

    // 콤보
    if (state.combo >= 5) {
      c.save()
      c.font = 'bold 84px sans-serif'
      c.textAlign = 'center'
      c.fillStyle = 'rgb(255 255 255 / 0.85)'
      c.fillText(`x${state.combo}`, 360, 560)
      c.restore()
    }

    // HUD: 점수 카드 + 체력 바
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(160, 24, 400, 130, 24)
    c.fill()
    c.restore()
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 56)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 112)
    c.font = '20px sans-serif'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(`MAX x${state.maxCombo}`, 360, 144)

    const hpRatio = state.health / 100
    c.fillStyle = 'rgb(255 255 255 / 0.15)'
    c.beginPath()
    c.roundRect(160, 172, 400, 16, 8)
    c.fill()
    c.fillStyle = hpRatio > 0.5 ? '#4DD679' : hpRatio > 0.25 ? '#FFC94D' : '#FF5252'
    c.beginPath()
    c.roundRect(160, 172, Math.max(16, 400 * hpRatio), 16, 8)
    c.fill()

    // 하단 탭 버튼
    for (let i = 0; i < LANES; i++) {
      const x = LANE_X + i * LANE_W
      const active = press[i] > 0
      c.save()
      c.fillStyle = LANE_COLORS[i]
      c.globalAlpha = active ? 0.95 : 0.55
      c.beginPath()
      c.roundRect(x + 10, BTN_Y, LANE_W - 20, BTN_H, 20)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
