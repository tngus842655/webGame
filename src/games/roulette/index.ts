import { t } from '@/shared/i18n'
import { playDrop, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { bonusPercent, createState, grantAdSpins, startSpin, update, SEGMENTS } from './state'

// 화면 배치 (논리 720×1280)
const WHEEL_X = 360
const WHEEL_Y = 560
const WHEEL_R = 270
const SPIN_BTN = { x: 200, y: 950, w: 320, h: 104 } as const
const AD_BTN = { x: 160, y: 1080, w: 400, h: 84 } as const

const SEG_COLORS = ['#EF5350', '#42A5F5', '#FFB300', '#66BB6A', '#AB47BC', '#26C6DA', '#FF7043', '#9CCC65']

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    playTime += dt
    const wasSpinning = state.phase === 'spinning'
    const result = update(state, dt)
    if (wasSpinning) {
      // 세그먼트 경계를 지날 때 틱 소리
      const seg = 360 / SEGMENTS.length
      if (Math.floor(state.angle / seg) !== lastTickSeg) {
        lastTickSeg = Math.floor(state.angle / seg)
        playDrop()
      }
    }
    if (result.landed) {
      playMerge(SEGMENTS[state.resultIndex] >= 2000 ? 6 : 4)
      vibrate([20, 40, 20])
      void ctx.submitScore(state.today)
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let playTime = 0
  let lastTickSeg = 0

  // 광고 보상: 스핀 +2 (하루 1회)
  async function adSpins() {
    if (state.adUsed || state.phase === 'spinning') return
    const rewarded = await ctx.showRewardAd('roulette-spins')
    if (shell.isDestroyed() || !rewarded) return
    if (grantAdSpins(state)) playMerge(5)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (
        p.x >= SPIN_BTN.x &&
        p.x <= SPIN_BTN.x + SPIN_BTN.w &&
        p.y >= SPIN_BTN.y &&
        p.y <= SPIN_BTN.y + SPIN_BTN.h
      ) {
        if (startSpin(state)) vibrate(15)
        return
      }
      const adVisible = !state.adUsed && ctx.isRewardAdReady() && state.phase !== 'spinning'
      if (
        adVisible &&
        p.x >= AD_BTN.x &&
        p.x <= AD_BTN.x + AD_BTN.w &&
        p.y >= AD_BTN.y &&
        p.y <= AD_BTN.y + AD_BTN.h
      ) {
        void adSpins()
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#4A148C', '#6A1B9A')

    // HUD: 오늘 합계 + 스트릭 보너스
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.12
    c.beginPath()
    c.roundRect(140, 24, 440, 150, 24)
    c.fill()
    c.restore()
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.font = '19px sans-serif'
    c.fillText(t('rl.today'), 360, 58)
    c.fillStyle = '#FFD54F'
    c.font = 'bold 54px sans-serif'
    c.fillText(state.today.toLocaleString(), 360, 118)
    c.fillStyle = '#FFAB91'
    c.font = 'bold 22px sans-serif'
    c.fillText(t('rl.bonus', { n: state.streak, p: bonusPercent(state.streak) }), 360, 156)

    // 휠
    const seg = (Math.PI * 2) / SEGMENTS.length
    c.save()
    c.translate(WHEEL_X, WHEEL_Y)
    c.rotate((state.angle * Math.PI) / 180)
    for (let i = 0; i < SEGMENTS.length; i++) {
      c.fillStyle = SEG_COLORS[i]
      c.beginPath()
      c.moveTo(0, 0)
      c.arc(0, 0, WHEEL_R, i * seg, (i + 1) * seg)
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgb(255 255 255 / 0.5)'
      c.lineWidth = 3
      c.stroke()
      // 값 텍스트
      c.save()
      c.rotate((i + 0.5) * seg)
      c.translate(WHEEL_R * 0.66, 0)
      c.rotate(Math.PI / 2)
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 34px sans-serif'
      c.textBaseline = 'middle'
      c.fillText(SEGMENTS[i].toLocaleString(), 0, 0)
      c.restore()
    }
    c.restore()
    // 테두리·허브
    c.strokeStyle = '#FFD54F'
    c.lineWidth = 10
    c.beginPath()
    c.arc(WHEEL_X, WHEEL_Y, WHEEL_R + 5, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#4A148C'
    c.beginPath()
    c.arc(WHEEL_X, WHEEL_Y, 56, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#FFD54F'
    c.lineWidth = 5
    c.stroke()
    c.font = '44px sans-serif'
    c.textBaseline = 'middle'
    c.fillText('🎁', WHEEL_X, WHEEL_Y + 2)
    c.textBaseline = 'alphabetic'
    // 포인터
    c.fillStyle = '#FFD54F'
    c.beginPath()
    c.moveTo(WHEEL_X, WHEEL_Y - WHEEL_R + 34)
    c.lineTo(WHEEL_X - 26, WHEEL_Y - WHEEL_R - 22)
    c.lineTo(WHEEL_X + 26, WHEEL_Y - WHEEL_R - 22)
    c.closePath()
    c.fill()

    // 당첨 팝업
    if (state.popupAge < 1.4) {
      const k = state.popupAge / 1.4
      c.save()
      c.globalAlpha = 1 - k
      c.font = 'bold 72px sans-serif'
      c.lineWidth = 10
      c.strokeStyle = '#4A148C'
      c.fillStyle = '#FFD54F'
      const text = `+${state.lastWin.toLocaleString()}`
      c.strokeText(text, WHEEL_X, WHEEL_Y - 40 - k * 60)
      c.fillText(text, WHEEL_X, WHEEL_Y - 40 - k * 60)
      c.restore()
    }

    // 스핀 버튼 / 내일 안내
    if (state.phase === 'day-done') {
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 36px sans-serif'
      c.fillText(t('rl.tomorrow'), 360, 1010)
    } else {
      const active = state.phase === 'idle'
      c.save()
      if (active) {
        const pulse = 1 + Math.sin(playTime * 5) * 0.02
        c.translate(360, SPIN_BTN.y + SPIN_BTN.h / 2)
        c.scale(pulse, pulse)
        c.translate(-360, -(SPIN_BTN.y + SPIN_BTN.h / 2))
      }
      c.fillStyle = active ? '#FF6F00' : '#9E9E9E'
      c.beginPath()
      c.roundRect(SPIN_BTN.x, SPIN_BTN.y, SPIN_BTN.w, SPIN_BTN.h, 28)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 38px sans-serif'
      c.textBaseline = 'middle'
      c.fillText(
        `${t('rl.spin')} (${state.spinsLeft})`,
        360,
        SPIN_BTN.y + SPIN_BTN.h / 2 + 2,
      )
      c.textBaseline = 'alphabetic'
      c.restore()
    }

    // 광고 버튼
    if (!state.adUsed && ctx.isRewardAdReady() && state.phase !== 'spinning') {
      c.fillStyle = '#43A047'
      c.beginPath()
      c.roundRect(AD_BTN.x, AD_BTN.y, AD_BTN.w, AD_BTN.h, 22)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 27px sans-serif'
      c.textBaseline = 'middle'
      c.fillText(t('rl.ad'), 360, AD_BTN.y + AD_BTN.h / 2 + 1)
      c.textBaseline = 'alphabetic'
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
