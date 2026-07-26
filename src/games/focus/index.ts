import { t } from '@/shared/i18n'
import { playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { addTodayMinutes, createState, progress, todayMinutes, DURATIONS } from './state'

// 화면 배치 (논리 720×1280)
const PICK_BTN = { w: 560, h: 150, x: 80, y0: 420, gap: 40 } as const
const GIVEUP = { x: 260, y: 1150, w: 200, h: 76 } as const
const END_BTN = { x: 140, w: 440, h: 110 } as const
const GROUND_Y = 1000

function skyColor(p: number, withered: boolean): { top: string; bottom: string } {
  if (withered) return { top: '#78909C', bottom: '#B0BEC5' }
  // 아침 → 노을로 천천히 물든다
  const lerp = (a: number[], b: number[]) =>
    `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * p)).join(' ')})`
  return {
    top: lerp([116, 192, 240], [255, 148, 112]),
    bottom: lerp([196, 230, 250], [255, 205, 158]),
  }
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'growing') {
      state.elapsed += dt
      if (progress(state) >= 1) {
        state.phase = 'done'
        todayTotal = addTodayMinutes(state.minutes)
        playMerge(6)
        vibrate([30, 60, 30])
        void ctx.submitScore(todayTotal)
      }
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let todayTotal = todayMinutes()
  let reviveUsed = false

  // 핵심 규칙: 자라는 동안 화면을 벗어나면 나무가 시든다
  const onVisibility = () => {
    if (document.hidden && state.phase === 'growing') {
      state.phase = 'withered'
      playGameOver()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  shell.addCleanup(() => document.removeEventListener('visibilitychange', onVisibility))

  // 광고 보상: 시든 나무를 살려 이어서 집중 (세션당 1회)
  async function reviveWithAd() {
    if (state.phase !== 'withered' || reviveUsed) return
    const rewarded = await ctx.showRewardAd('focus-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'withered') return
    reviveUsed = true
    state.phase = 'growing'
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase === 'select') {
        for (let i = 0; i < DURATIONS.length; i++) {
          const y = PICK_BTN.y0 + i * (PICK_BTN.h + PICK_BTN.gap)
          if (p.x >= PICK_BTN.x && p.x <= PICK_BTN.x + PICK_BTN.w && p.y >= y && p.y <= y + PICK_BTN.h) {
            state.minutes = DURATIONS[i]
            state.elapsed = 0
            state.phase = 'growing'
            reviveUsed = false
            playMerge(3)
            return
          }
        }
      } else if (state.phase === 'growing') {
        if (
          p.x >= GIVEUP.x &&
          p.x <= GIVEUP.x + GIVEUP.w &&
          p.y >= GIVEUP.y &&
          p.y <= GIVEUP.y + GIVEUP.h
        ) {
          state.phase = 'withered'
          playGameOver()
        }
      } else {
        // 종료 화면 버튼: (시든 경우) 광고 살리기 / 새 나무 심기
        const adVisible = state.phase === 'withered' && ctx.isRewardAdReady() && !reviveUsed
        const adY = 760
        const newY = adVisible ? 900 : 800
        if (adVisible && p.x >= END_BTN.x && p.x <= END_BTN.x + END_BTN.w && p.y >= adY && p.y <= adY + END_BTN.h) {
          void reviveWithAd()
          return
        }
        if (p.x >= END_BTN.x && p.x <= END_BTN.x + END_BTN.w && p.y >= newY && p.y <= newY + END_BTN.h) {
          Object.assign(state, createState())
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  // 나무: 성장도 0~1에 따라 줄기·가지·잎이 자란다
  const drawTree = (c: CanvasRenderingContext2D, p: number, withered: boolean) => {
    const cx = 360
    const trunkH = 80 + p * 300
    const trunkW = 16 + p * 26
    c.strokeStyle = withered ? '#6D6D6D' : '#6D4C41'
    c.lineCap = 'round'
    c.lineWidth = trunkW
    c.beginPath()
    c.moveTo(cx, GROUND_Y)
    c.quadraticCurveTo(cx - 14, GROUND_Y - trunkH * 0.55, cx, GROUND_Y - trunkH)
    c.stroke()

    // 가지 (성장 0.25부터 순서대로)
    const branches: Array<[number, number, number]> = [
      [0.25, -1, 0.55],
      [0.4, 1, 0.68],
      [0.55, -1, 0.82],
      [0.7, 1, 0.92],
    ]
    for (const [at, dir, h] of branches) {
      if (p < at) continue
      const k = Math.min(1, (p - at) / 0.2)
      const bx = cx
      const by = GROUND_Y - trunkH * h
      c.lineWidth = trunkW * 0.45
      c.beginPath()
      c.moveTo(bx, by)
      c.quadraticCurveTo(
        bx + dir * 50 * k,
        by - 30 * k,
        bx + dir * (70 + 40 * p) * k,
        by - (50 + 30 * p) * k,
      )
      c.stroke()
    }

    // 잎: 위쪽에 뭉게뭉게 (시들면 칙칙하게)
    if (p > 0.15) {
      const leaf = withered ? '#9E9D24' : '#66BB6A'
      const leafDark = withered ? '#827717' : '#43A047'
      const top = GROUND_Y - trunkH
      const r = 30 + p * 120
      c.globalAlpha = withered ? 0.55 : 1
      const blobs: Array<[number, number, number]> = [
        [0, -r * 0.45, 1],
        [-r * 0.7, -r * 0.1, 0.75],
        [r * 0.7, -r * 0.1, 0.75],
        [-r * 0.35, -r * 0.75, 0.6],
        [r * 0.35, -r * 0.75, 0.6],
      ]
      blobs.forEach(([dx, dy, s], i) => {
        c.fillStyle = i % 2 === 0 ? leaf : leafDark
        c.beginPath()
        c.arc(cx + dx * p, top + dy * p - 10, r * s * 0.6 + 14, 0, Math.PI * 2)
        c.fill()
      })
      c.globalAlpha = 1
      // 만개: 꽃
      if (p > 0.85 && !withered) {
        c.fillStyle = '#F48FB1'
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          const rr = r * (0.35 + ((i * 37) % 10) / 18)
          c.beginPath()
          c.arc(cx + Math.cos(a) * rr * 0.9, top - 10 - r * 0.35 + Math.sin(a) * rr * 0.55, 7, 0, Math.PI * 2)
          c.fill()
        }
      }
    }
  }

  const drawButton = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    bg: string,
    fg = '#FFFFFF',
  ) => {
    c.fillStyle = bg
    c.beginPath()
    c.roundRect(x, y, w, h, h / 3)
    c.fill()
    c.fillStyle = fg
    c.font = 'bold 32px sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(label, x + w / 2, y + h / 2 + 1)
    c.textBaseline = 'alphabetic'
  }

  const draw = () => {
    const p = progress(state)
    const withered = state.phase === 'withered'
    const sky = skyColor(p, withered)
    const c = stage.begin(sky.top, sky.bottom)

    // 해 (진행에 따라 넘어간다)
    if (!withered) {
      c.fillStyle = '#FFEE58'
      c.beginPath()
      c.arc(120 + p * 480, 200 - Math.sin(p * Math.PI) * 90, 46, 0, Math.PI * 2)
      c.fill()
    }

    // 땅
    c.fillStyle = withered ? '#A1887F' : '#8BC34A'
    c.fillRect(0, GROUND_Y, 720, 1280 - GROUND_Y)
    c.fillStyle = withered ? '#8D6E63' : '#7CB342'
    c.fillRect(0, GROUND_Y, 720, 22)

    if (state.phase === 'select') {
      c.fillStyle = '#33691E'
      c.font = 'bold 40px sans-serif'
      c.textAlign = 'center'
      c.fillText(t('fc.pick'), 360, 300)
      c.font = '26px sans-serif'
      c.fillStyle = '#558B2F'
      c.fillText(t('fc.today', { n: todayTotal }), 360, 356)
      DURATIONS.forEach((minutes, i) => {
        const y = PICK_BTN.y0 + i * (PICK_BTN.h + PICK_BTN.gap)
        c.save()
        c.fillStyle = '#FFFFFF'
        c.globalAlpha = 0.92
        c.beginPath()
        c.roundRect(PICK_BTN.x, y, PICK_BTN.w, PICK_BTN.h, 32)
        c.fill()
        c.restore()
        c.fillStyle = '#33691E'
        c.font = 'bold 44px sans-serif'
        c.textBaseline = 'middle'
        c.fillText(`🌱 ${t('fc.min', { n: minutes })}`, 360, y + PICK_BTN.h / 2 + 2)
        c.textBaseline = 'alphabetic'
      })
      drawTree(c, 0.1, false)
      return
    }

    drawTree(c, withered ? p : state.phase === 'done' ? 1 : p, withered)

    c.textAlign = 'center'
    if (state.phase === 'growing') {
      const left = state.minutes * 60 - state.elapsed
      const mm = Math.floor(left / 60)
      const ss = String(Math.max(0, Math.floor(left % 60))).padStart(2, '0')
      c.fillStyle = 'rgb(255 255 255 / 0.85)'
      c.font = 'bold 96px sans-serif'
      c.fillText(`${mm}:${ss}`, 360, 200)
      c.font = '26px sans-serif'
      c.fillText(t('fc.stay'), 360, 260)
      drawButton(c, GIVEUP.x, GIVEUP.y, GIVEUP.w, GIVEUP.h, t('fc.giveup'), 'rgb(0 0 0 / 0.25)')
    } else if (state.phase === 'done') {
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 48px sans-serif'
      c.fillText(t('fc.done'), 360, 250)
      c.font = 'bold 34px sans-serif'
      c.fillText(t('fc.today', { n: todayTotal }), 360, 330)
      drawButton(c, END_BTN.x, 800, END_BTN.w, END_BTN.h, t('fc.new'), '#43A047')
    } else {
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 48px sans-serif'
      c.fillText(t('fc.withered'), 360, 250)
      c.font = 'bold 30px sans-serif'
      c.fillText(t('fc.today', { n: todayTotal }), 360, 330)
      const adVisible = ctx.isRewardAdReady() && !reviveUsed
      if (adVisible) drawButton(c, END_BTN.x, 760, END_BTN.w, END_BTN.h, t('fc.ad'), '#43A047')
      drawButton(c, END_BTN.x, adVisible ? 900 : 800, END_BTN.w, END_BTN.h, t('fc.new'), '#78909C')
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
