import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BOTTOM_Y,
  BOX_X,
  BOX_Y,
  COLORS,
  RADIUS,
  SHAPES,
  SPAWN_Y,
  createState,
  reviveWithLife,
  sort,
  update,
  type Criterion,
  type Piece,
  type ShapeKind,
  type Side,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconRow } from '../icons'

const TAP_SLOP = 40 // 이보다 적게 움직이면 스와이프가 아니라 좌우 절반 탭으로 본다

// 도형에 두께를 주려고 색마다 밝은 면과 어두운 면을 손으로 잡아 둔다.
// 가운데 색은 state.ts의 COLORS — 기준을 판정하는 값이라 여기서 갈아끼우면 안 된다.
interface Tone {
  light: string
  base: string
  dark: string
}
const TONES: Tone[] = [
  { light: '#FF9A94', base: COLORS[0], dark: '#A81E19' },
  { light: '#FFE7A0', base: COLORS[1], dark: '#B67F00' },
  { light: '#9FD4FF', base: COLORS[2], dark: '#12599E' },
]
// 크기가 기준일 때는 색이 단서가 되면 안 되므로 무채색 하나만 쓴다
const NEUTRAL: Tone = { light: '#F2F6F8', base: '#CFD8DC', dark: '#7E8C95' }

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}
const POPUP_LIFE = 0.8

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    // update가 놓친 도형을 지워버리므로 미리 붙잡아 둔다
    const falling = state.piece
    const events = update(state, dt)
    if (events.missed) {
      playDrop()
      vibrate(80)
      shake = 1
      if (falling) splat(falling)
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  const particles: Particle[] = []
  const popups: Array<{ x: number; y: number; gain: number; age: number }> = []
  const boxPop = { left: 0, right: 0 }
  let shake = 0
  let adReviveUsed = false
  let down: { x: number; y: number } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'sg.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      particles.length = 0
      popups.length = 0
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('sortgate-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveWithLife(state)
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

  const toneOf = (piece: Piece) => TONES[piece.color]

  // 놓친 도형이 바닥에 부딪혀 부서진다 — 조용히 사라지면 무슨 일이 났는지 모른다
  const splat = (piece: Piece) => {
    const tone = toneOf(piece)
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const v = 130 + Math.random() * 230
      particles.push({
        x: 360 + (Math.random() - 0.5) * 60,
        y: BOTTOM_Y - 6,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.5,
        r: 4 + Math.random() * 6,
        color: i % 3 === 0 ? tone.light : tone.base,
      })
    }
  }

  const burstBox = (side: Side, tone: Tone) => {
    const cx = BOX_X[side === -1 ? 'left' : 'right']
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const v = 120 + Math.random() * 150
      particles.push({
        x: cx,
        y: BOX_Y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.42,
        r: 3 + Math.random() * 4,
        color: i % 2 === 0 ? '#FFFFFF' : tone.light,
      })
    }
  }

  const stepEffects = (dt: number) => {
    shake = Math.max(0, shake - dt * 3)
    boxPop.left = Math.max(0, boxPop.left - dt * 3.4)
    boxPop.right = Math.max(0, boxPop.right - dt * 3.4)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      if (p.age >= p.life) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 1300 * dt
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age >= POPUP_LIFE) popups.splice(i, 1)
    }
  }

  const push = (side: Side) => {
    const piece = state.piece
    const before = state.score
    const correct = sort(state, side)
    if (correct === null || !piece) return
    const key = side === -1 ? 'left' : 'right'
    if (correct) {
      playMerge(Math.min(6, 2 + Math.floor(state.streak / 3)))
      vibrate(12)
      boxPop[key] = 1
      burstBox(side, toneOf(piece))
      popups.push({ x: BOX_X[key], y: BOX_Y - 96, gain: state.score - before, age: 0 })
    } else {
      playDrop()
      vibrate(90)
      shake = 1
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      down = stage.toBoard(clientX, clientY)
    },
    onMove() {},
    onUp(clientX, clientY) {
      if (!down) return
      const p = stage.toBoard(clientX, clientY)
      const dx = p.x - down.x
      // 스와이프 방향 우선, 거의 움직이지 않았으면 누른 쪽 절반
      push(Math.abs(dx) >= TAP_SLOP ? (dx > 0 ? 1 : -1) : down.x < 360 ? -1 : 1)
      down = null
    },
  })

  const shapePath = (kind: ShapeKind, cx: number, cy: number, r: number) => {
    const c = stage.c
    c.beginPath()
    if (kind === 'circle') {
      c.arc(cx, cy, r, 0, Math.PI * 2)
    } else if (kind === 'triangle') {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3
        const x = cx + Math.cos(a) * r * 1.14
        const y = cy + Math.sin(a) * r * 1.14
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
    } else {
      const s = r * 1.72
      c.roundRect(cx - s / 2, cy - s / 2, s, s, r * 0.24)
    }
  }

  // 도형 하나. 실루엣(동그라미·세모·네모)과 색은 이 게임이 규칙을 전달하는 언어라
  // 그대로 두고, 명암과 두께만 얹어 납작한 색면이 아니라 집어 옮기는 물건으로 만든다.
  const drawSolid = (kind: ShapeKind, cx: number, cy: number, r: number, tone: Tone) => {
    const c = stage.c
    c.save()
    c.fillStyle = 'rgb(0 0 0 / 0.28)'
    shapePath(kind, cx + r * 0.09, cy + r * 0.15, r)
    c.fill()

    const grad = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    grad.addColorStop(0, tone.light)
    grad.addColorStop(0.52, tone.base)
    grad.addColorStop(1, tone.dark)
    c.fillStyle = grad
    shapePath(kind, cx, cy, r)
    c.fill()
    c.strokeStyle = tone.dark
    c.lineWidth = Math.max(2, r * 0.07)
    c.stroke()

    // 왼쪽 위에서 온 빛
    c.save()
    shapePath(kind, cx, cy, r)
    c.clip()
    c.fillStyle = 'rgb(255 255 255 / 0.42)'
    c.beginPath()
    c.ellipse(cx - r * 0.34, cy - r * 0.44, r * 0.4, r * 0.22, -0.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgb(0 0 0 / 0.18)'
    c.beginPath()
    c.ellipse(cx, cy + r * 1.05, r * 1.3, r * 0.45, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
    c.restore()
  }

  // 상자 기준: 그 상자에 들어갈 수 있는 예시 셋을 나란히 그린다.
  // 기준과 무관한 속성은 셋 안에서 흩어지므로 '무엇이 같은지'가 곧 기준이 된다.
  const drawCriterion = (crit: Criterion, side: 'left' | 'right', scale: number) => {
    const value = side === 'left' ? crit.left : crit.right
    const cx = BOX_X[side]
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 62 * scale
      if (crit.axis === 'color') drawSolid(SHAPES[i], x, BOX_Y, 20 * scale, TONES[value])
      else if (crit.axis === 'shape') drawSolid(SHAPES[value], x, BOX_Y, 20 * scale, TONES[i])
      else drawSolid(SHAPES[i], x, BOX_Y, (value === 0 ? 13 : 26) * scale, NEUTRAL)
    }
  }

  // 게이트 — 테두리 하나였던 것을 입구가 파인 통으로. 맞게 넣으면 통째로 튀어오른다.
  const drawBox = (side: 'left' | 'right') => {
    const c = stage.c
    const cx = BOX_X[side]
    const announcing = state.announce > 0
    const hinted = state.hintTimer > 0 && state.hintSide === (side === 'left' ? -1 : 1)
    const pop = boxPop[side]
    const w = 264
    const h = 156

    c.save()
    c.translate(cx, BOX_Y - pop * 10)
    const body = c.createLinearGradient(0, -h / 2, 0, h / 2)
    body.addColorStop(0, 'rgb(255 255 255 / 0.14)')
    body.addColorStop(1, 'rgb(255 255 255 / 0.04)')
    c.fillStyle = body
    c.beginPath()
    c.roundRect(-w / 2, -h / 2, w, h, 22)
    c.fill()
    // 안쪽으로 파인 면
    c.fillStyle = 'rgb(0 0 0 / 0.26)'
    c.beginPath()
    c.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 16)
    c.fill()
    // 입구 립 — 위쪽만 밝아 통이 열려 있는 것으로 보인다
    c.fillStyle = 'rgb(255 255 255 / 0.24)'
    c.beginPath()
    c.roundRect(-w / 2 + 6, -h / 2 + 3, w - 12, 9, 5)
    c.fill()

    c.lineWidth = hinted || announcing || pop > 0 ? 6 : 3
    c.strokeStyle = hinted
      ? '#66BB6A'
      : pop > 0
        ? `rgb(255 255 255 / ${0.3 + pop * 0.7})`
        : announcing
          ? `rgb(255 213 79 / ${0.5 + 0.5 * Math.sin(state.announce * 12)})`
          : 'rgb(255 255 255 / 0.18)'
    c.beginPath()
    c.roundRect(-w / 2, -h / 2, w, h, 22)
    c.stroke()
    c.restore()

    // 예고 중에는 기준을 크게 — 광고로 이어할 때도 같은 연출을 3초간 쓴다
    c.save()
    c.translate(0, -pop * 10)
    drawCriterion(state.crit, side, announcing ? 1.22 : 1)
    c.restore()

    // 어느 쪽으로 밀어야 하는지 알려주는 꼬리표
    c.strokeStyle = 'rgb(255 255 255 / 0.35)'
    c.lineWidth = 5
    c.lineCap = 'round'
    const ax = side === 'left' ? cx - 158 : cx + 158
    const dir = side === 'left' ? -1 : 1
    c.beginPath()
    c.moveTo(ax - dir * 9, BOX_Y - 13)
    c.lineTo(ax + dir * 9, BOX_Y)
    c.lineTo(ax - dir * 9, BOX_Y + 13)
    c.stroke()
    c.lineCap = 'butt'
  }

  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const bg = c.createLinearGradient(0, 0, 0, 1280)
    bg.addColorStop(0, '#16232B')
    bg.addColorStop(0.55, '#22363F')
    bg.addColorStop(1, '#141F26')
    c.fillStyle = bg
    c.fillRect(0, 0, 720, 1280)
    // 게이트가 붙어 있는 벽
    c.fillStyle = 'rgb(0 0 0 / 0.16)'
    c.fillRect(0, 180, 720, 216)
    c.strokeStyle = 'rgb(255 255 255 / 0.05)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, 396)
    c.lineTo(720, 396)
    c.stroke()
    // 도형이 떨어지는 자리에 내리는 빛 — 지금 봐야 할 곳을 눈이 먼저 찾는다
    const beam = c.createLinearGradient(0, SPAWN_Y - 90, 0, BOTTOM_Y)
    beam.addColorStop(0, 'rgb(255 255 255 / 0.075)')
    beam.addColorStop(1, 'rgb(255 255 255 / 0)')
    c.fillStyle = beam
    c.beginPath()
    c.moveTo(300, SPAWN_Y - 90)
    c.lineTo(420, SPAWN_Y - 90)
    c.lineTo(492, BOTTOM_Y)
    c.lineTo(228, BOTTOM_Y)
    c.closePath()
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#101A20', '#16232B')
    drawBackdrop(c)

    c.save()
    if (shake > 0) c.translate((Math.random() - 0.5) * 16 * shake, (Math.random() - 0.5) * 10 * shake)

    drawBox('left')
    drawBox('right')

    // 낙하 레인
    c.save()
    c.strokeStyle = 'rgb(255 255 255 / 0.07)'
    c.lineWidth = 2
    c.setLineDash([10, 14])
    c.beginPath()
    c.moveTo(360, SPAWN_Y - 60)
    c.lineTo(360, BOTTOM_Y)
    c.stroke()
    c.restore()

    // 바닥선 — 여기까지 내려오면 놓친 것
    const danger = state.wrongFlash > 0
    c.fillStyle = danger ? '#EF5350' : '#37474F'
    c.fillRect(0, BOTTOM_Y, 720, 12)
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    for (let x = 0; x < 720; x += 48) c.fillRect(x, BOTTOM_Y, 24, 12)
    const floor = c.createLinearGradient(0, BOTTOM_Y + 12, 0, BOTTOM_Y + 100)
    floor.addColorStop(0, danger ? 'rgb(239 83 80 / 0.4)' : 'rgb(0 0 0 / 0.35)')
    floor.addColorStop(1, 'rgb(0 0 0 / 0)')
    c.fillStyle = floor
    c.fillRect(0, BOTTOM_Y + 12, 720, 100)

    // 기준 예고: 남은 시간이 줄어드는 고리
    if (state.announce > 0) {
      const ratio = state.announce / state.announceSpan
      c.save()
      c.translate(360, 412)
      c.strokeStyle = 'rgb(255 255 255 / 0.12)'
      c.lineWidth = 7
      c.beginPath()
      c.arc(0, 0, 24, 0, Math.PI * 2)
      c.stroke()
      c.strokeStyle = '#FFD54F'
      c.beginPath()
      c.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
      c.stroke()
      c.restore()
    }

    const piece = state.piece
    if (piece) {
      const r = RADIUS[piece.size]
      let x = 360
      let y = piece.y
      let alpha = 1
      let scale = 1
      if (piece.side !== 0) {
        // 상자로 빨려 들어가는 연출 — 어디로 갔는지 눈으로 확인시킨다
        const e = 1 - (1 - piece.fly) * (1 - piece.fly)
        const target = BOX_X[piece.side === -1 ? 'left' : 'right']
        x = 360 + (target - 360) * e
        y = piece.y + (BOX_Y - piece.y) * e
        alpha = 1 - e * 0.75
        scale = 1 - e * 0.45
      }
      c.save()
      c.globalAlpha = alpha
      drawSolid(piece.kind, x, y, r * scale, toneOf(piece))
      c.restore()

      // 처음 몇 개까지만 좌우로 밀라는 표시를 도형 옆에 띄운다
      if (piece.side === 0 && state.resolved < 3) {
        c.save()
        c.globalAlpha = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(state.playTime * 5))
        c.strokeStyle = '#FFFFFF'
        c.lineWidth = 6
        c.lineCap = 'round'
        for (const dir of [-1, 1]) {
          const ax = 360 + dir * (r + 68)
          c.beginPath()
          c.moveTo(ax - dir * 12, y - 16)
          c.lineTo(ax + dir * 12, y)
          c.lineTo(ax - dir * 12, y + 16)
          c.stroke()
        }
        c.restore()
      }
    }

    for (const p of particles) {
      const k = p.age / p.life
      c.globalAlpha = 1 - k * k
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
    c.restore()

    // 맞게 넣고 받은 점수
    c.textAlign = 'center'
    c.font = font(30, true)
    for (const p of popups) {
      const k = p.age / POPUP_LIFE
      c.save()
      c.globalAlpha = 1 - k * k
      c.lineJoin = 'round'
      c.lineWidth = 7
      c.strokeStyle = 'rgb(16 26 32 / 0.85)'
      c.strokeText(`+${p.gain}`, p.x, p.y - k * 38)
      c.fillStyle = '#FFD54F'
      c.fillText(`+${p.gain}`, p.x, p.y - k * 38)
      c.restore()
    }

    if (state.wrongFlash > 0) {
      c.save()
      c.globalAlpha = state.wrongFlash * 0.5
      c.fillStyle = '#EF5350'
      c.fillRect(0, 0, 720, 1280)
      c.restore()
    }

    // HUD: 점수 + 목숨
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    drawIconRow(c, 'heart', SCORE_PANEL.cx, SCORE_PANEL.subY - 6, 13, state.lives, Math.max(3, state.lives))

    // 연속 정답 — 점수 보너스가 붙는데 지금 몇 연속인지 볼 곳이 없었다.
    // 가운데는 도형이 내려오는 길이라 옆으로 비켜 둔다.
    if (state.streak >= 3) {
      c.font = font(30, true)
      c.textAlign = 'center'
      c.fillStyle = '#FFD54F'
      c.fillText(`x${state.streak}`, 104, 462)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
