import { t } from '@/shared/i18n'
import { playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BOUNDS,
  COLORS,
  DOCK_R,
  activeDocks,
  clearCrashPair,
  createState,
  extendPath,
  grabBoat,
  update,
  type Boat,
  type Dock,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

// 색마다 짝지은 표식. 배와 부두를 색으로만 이으면 색이 비슷하게 보이는 사람은
// 손댈 수가 없다. 같은 표식을 배의 돛과 부두 등대에 함께 새겨 둔다.
type MarkKind = 0 | 1 | 2 | 3

function drawMark(
  c: CanvasRenderingContext2D,
  kind: MarkKind,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  c.save()
  c.beginPath()
  if (kind === 0) {
    c.arc(x, y, s * 0.86, 0, Math.PI * 2)
  } else if (kind === 1) {
    c.moveTo(x, y - s)
    c.lineTo(x + s * 0.92, y + s * 0.7)
    c.lineTo(x - s * 0.92, y + s * 0.7)
    c.closePath()
  } else if (kind === 2) {
    c.roundRect(x - s * 0.78, y - s * 0.78, s * 1.56, s * 1.56, s * 0.22)
  } else {
    const t = s * 0.32
    c.roundRect(x - t, y - s, t * 2, s * 2, t * 0.6)
    c.roundRect(x - s, y - t, s * 2, t * 2, t * 0.6)
  }
  c.fillStyle = color
  c.fill()
  c.restore()
}

// 물빛 반짝임 — 판마다 같은 못을 쓰려고 모듈을 읽을 때 한 번만 만든다
const GLINTS = Array.from({ length: 46 }, () => ({
  x: BOUNDS.x0 + Math.random() * (BOUNDS.x1 - BOUNDS.x0),
  y: BOUNDS.y0 + Math.random() * (BOUNDS.y1 - BOUNDS.y0),
  r: 2 + Math.random() * 4,
  phase: Math.random() * Math.PI * 2,
  speed: 0.7 + Math.random() * 1.1,
}))

interface Scrap {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  age: number
  life: number
  color: string
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.docked > 0) {
      // 새 부두가 열린 판이면 그것부터 알린다 (state가 dockFlash로 표시해 준다)
      if (state.dockFlash > 0) playSfx('unlock')
      playSfx('water')
      playMerge(Math.min(6, 2 + state.combo))
      vibrate(12)
      dockRing = 1
    }
    if (events.crashed) {
      playSfx('impact')
      vibrate([40, 60, 80])
      if (state.crash) burstScraps(state.crash.x, state.crash.y)
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
  preloadSfx('gameover', 'impact', 'merge', 'tap', 'unlock', 'water')
  const scraps: Scrap[] = []
  let dockRing = 0
  let dragging: Boat | null = null
  let adClearUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'pb.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adClearUsed = false
      dragging = null
      Object.assign(state, createState())
      scraps.length = 0
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adClearUsed) return
    const rewarded = await ctx.showRewardAd('paperboat-clear-pair')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adClearUsed = true
    clearCrashPair(state)
    scraps.length = 0
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

  // 부딪힌 배는 젖은 종이 조각이 되어 흩어진다
  const burstScraps = (x: number, y: number) => {
    for (const boat of state.crashed) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 70 + Math.random() * 190
        scraps.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y + (Math.random() - 0.5) * 24,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 9,
          age: 0,
          life: 0.9,
          color: COLORS[boat.color],
        })
      }
    }
  }

  const stepEffects = (dt: number) => {
    dockRing = Math.max(0, dockRing - dt * 1.8)
    for (let i = scraps.length - 1; i >= 0; i--) {
      const s = scraps[i]
      s.age += dt
      if (s.age >= s.life) {
        scraps.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      // 물에 떨어진 종이라 금방 느려진다
      s.vx *= 1 - dt * 2.4
      s.vy *= 1 - dt * 2.4
      s.rot += s.spin * dt
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      dragging = grabBoat(state, p.x, p.y)
      if (dragging) playSfx('tap')
    },
    onMove(clientX, clientY) {
      if (!dragging || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      extendPath(dragging, p.x, p.y)
    },
    onUp() {
      dragging = null
    },
  })

  // 종이배를 위에서 본 모습 — 접힌 능선을 기준으로 한쪽은 빛을 받고 한쪽은 그늘이다
  const drawBoat = (boat: Boat, highlight: boolean) => {
    const c = stage.c
    const color = COLORS[boat.color]
    const bob = Math.sin(state.playTime * 3 + boat.x * 0.05) * 1.5

    c.save()
    c.translate(boat.x, boat.y + bob)
    c.rotate(boat.heading)

    // 물살을 가르며 남기는 V자 항적
    c.save()
    c.globalAlpha = 0.5
    c.strokeStyle = 'rgb(255 255 255 / 0.4)'
    c.lineWidth = 2.5
    c.lineCap = 'round'
    for (const dir of [-1, 1]) {
      c.beginPath()
      c.moveTo(-8, dir * 6)
      c.quadraticCurveTo(-30, dir * 14, -54, dir * 24)
      c.stroke()
    }
    c.restore()

    // 물에 비친 그늘
    c.fillStyle = 'rgb(0 0 0 / 0.25)'
    c.beginPath()
    c.ellipse(-2, 4, 20, 14, 0, 0, Math.PI * 2)
    c.fill()

    // 선체 — 뱃머리가 뾰족하고 선미가 넓다
    c.beginPath()
    c.moveTo(22, 0)
    c.lineTo(-4, -16)
    c.lineTo(-16, -12)
    c.lineTo(-16, 12)
    c.lineTo(-4, 16)
    c.closePath()
    c.fillStyle = color
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.28)'
    c.lineWidth = 2
    c.stroke()

    // 접힌 면 — 위쪽 절반만 밝게 덮어 종이가 접혀 있는 것으로 보이게
    c.save()
    c.beginPath()
    c.moveTo(22, 0)
    c.lineTo(-4, -16)
    c.lineTo(-16, -12)
    c.lineTo(-16, 0)
    c.closePath()
    c.fillStyle = 'rgb(255 255 255 / 0.34)'
    c.fill()
    c.restore()

    // 가운데 능선
    c.strokeStyle = 'rgb(255 255 255 / 0.65)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(20, 0)
    c.lineTo(-16, 0)
    c.stroke()

    // 돛 자리에 얹은 표식 — 어느 부두로 갈 배인지 색 없이도 읽힌다.
    // 배가 어느 쪽으로 돌든 표식은 똑바로 서 있어야 읽힌다.
    c.fillStyle = 'rgb(255 255 255 / 0.9)'
    c.beginPath()
    c.arc(0, 0, 8.5, 0, Math.PI * 2)
    c.fill()
    c.rotate(-boat.heading)
    drawMark(c, boat.color as MarkKind, 0, 0, 5.5, color)
    c.restore()

    if (highlight) {
      c.strokeStyle = 'rgb(255 255 255 / 0.9)'
      c.lineWidth = 3
      c.setLineDash([8, 7])
      c.beginPath()
      c.arc(boat.x, boat.y, 30, 0, Math.PI * 2)
      c.stroke()
      c.setLineDash([])
    }
  }

  // 부두 — 색 원 하나였던 것을 나무 데크와 등대가 있는 자리로
  const drawDock = (dock: Dock) => {
    const c = stage.c
    const color = COLORS[dock.color]
    const opening = state.dockFlash > 0 && state.docked === dock.appearAt

    c.save()
    c.translate(dock.x, dock.y)
    c.rotate(dock.angle)
    // 물 쪽으로 뻗은 널판
    c.fillStyle = '#6D4C41'
    c.beginPath()
    c.roundRect(-58, -32, 60, 64, 6)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.14)'
    for (let i = 0; i < 4; i++) c.fillRect(-56, -30 + i * 16, 56, 5)
    // 말뚝
    c.fillStyle = '#4E342E'
    for (const y of [-30, 30]) {
      c.beginPath()
      c.arc(-4, y, 7, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()

    // 물 위 정박 자리
    c.beginPath()
    c.arc(dock.x, dock.y, DOCK_R, 0, Math.PI * 2)
    c.fillStyle = `${color}26`
    c.fill()
    c.lineWidth = opening ? 7 : 4
    c.strokeStyle = opening
      ? `rgb(255 255 255 / ${0.4 + 0.6 * Math.sin(state.dockFlash * 14)})`
      : color
    c.setLineDash(opening ? [] : [14, 9])
    c.stroke()
    c.setLineDash([])

    // 등대 — 색과 표식을 함께 든다
    c.fillStyle = 'rgb(255 255 255 / 0.92)'
    c.beginPath()
    c.arc(dock.x, dock.y, 17, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = color
    c.beginPath()
    c.arc(dock.x, dock.y, 14, 0, Math.PI * 2)
    c.fill()
    drawMark(c, dock.color as MarkKind, dock.x, dock.y, 8, 'rgb(255 255 255 / 0.95)')

    // 배가 막 들어온 부두에서 파문이 퍼진다
    if (dockRing > 0) {
      c.save()
      c.globalAlpha = dockRing * 0.7
      c.strokeStyle = color
      c.lineWidth = 4 * dockRing
      c.beginPath()
      c.arc(dock.x, dock.y, DOCK_R + (1 - dockRing) * 40, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }
  }

  const drawWater = (c: CanvasRenderingContext2D) => {
    const deep = c.createLinearGradient(0, BOUNDS.y0, 0, BOUNDS.y1)
    deep.addColorStop(0, '#0E4A69')
    deep.addColorStop(0.5, '#0C3D58')
    deep.addColorStop(1, '#07293C')
    c.fillStyle = deep
    c.fillRect(0, 0, 720, 1280)

    // 둔치 — 못 밖은 물이 아니다
    c.fillStyle = '#20404A'
    c.fillRect(0, 0, 720, BOUNDS.y0 - 14)
    c.fillRect(0, BOUNDS.y1 + 14, 720, 1280 - BOUNDS.y1)
    c.fillRect(0, 0, BOUNDS.x0 - 14, 1280)
    c.fillRect(BOUNDS.x1 + 14, 0, 720 - BOUNDS.x1, 1280)
    // 물가 — 둔치와 물이 만나는 선을 밝게
    c.strokeStyle = 'rgb(255 255 255 / 0.1)'
    c.lineWidth = 3
    c.strokeRect(BOUNDS.x0 - 14, BOUNDS.y0 - 14, BOUNDS.x1 - BOUNDS.x0 + 28, BOUNDS.y1 - BOUNDS.y0 + 28)

    // 천천히 흐르는 물결 두 겹 — 서로 반대로 흘러 물이 살아 있는 것처럼 보인다
    const flow = state.playTime * 14
    for (const layer of [
      { alpha: 0.05, amp: 8, off: flow, y0: BOUNDS.y0 },
      { alpha: 0.03, amp: 5, off: -flow * 0.6, y0: BOUNDS.y0 + 52 },
    ]) {
      c.strokeStyle = `rgb(255 255 255 / ${layer.alpha})`
      c.lineWidth = 3
      for (let y = layer.y0; y < BOUNDS.y1; y += 104) {
        c.beginPath()
        for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 20) {
          c.lineTo(x, y + Math.sin((x + layer.off) / 62 + y) * layer.amp)
        }
        c.stroke()
      }
    }

    // 윤슬
    for (const g of GLINTS) {
      const k = 0.5 + 0.5 * Math.sin(state.playTime * g.speed + g.phase)
      c.globalAlpha = 0.05 + k * 0.16
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(g.x, g.y, g.r * (1 + k), g.r * 0.45, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  // 부딪히기 전에 알려준다 — 충돌하면 즉시 끝나는 게임인데 예고가 없었다
  const drawWarnings = (c: CanvasRenderingContext2D) => {
    if (state.phase !== 'playing') return
    for (let i = 0; i < state.boats.length; i++) {
      for (let j = i + 1; j < state.boats.length; j++) {
        const a = state.boats[i]
        const b = state.boats[j]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > 108) continue
        const risk = 1 - (d - 32) / 76
        c.save()
        c.globalAlpha = Math.min(1, Math.max(0, risk)) * (0.45 + 0.55 * Math.sin(state.playTime * 14))
        c.strokeStyle = '#FF5252'
        c.lineWidth = 3
        c.setLineDash([9, 7])
        c.beginPath()
        c.moveTo(a.x, a.y)
        c.lineTo(b.x, b.y)
        c.stroke()
        c.setLineDash([])
        c.restore()
      }
    }
  }

  // 글자 없는 조작 안내 — 첫 배에서 같은 색 부두로 손끝이 항로를 그어 보인다
  const drawGuide = (c: CanvasRenderingContext2D) => {
    if (state.docked > 0 || dragging || state.phase !== 'playing') return
    const boat = state.boats[0]
    if (!boat) return
    const dock = activeDocks(state).find((d) => d.color === boat.color)
    if (!dock) return
    const k = (state.playTime % 2.4) / 2.4
    const draw = Math.min(1, k / 0.72)
    // 배와 부두 사이를 한 번 휘어 가는 길
    const mx = (boat.x + dock.x) / 2 + (dock.y - boat.y) * 0.16
    const my = (boat.y + dock.y) / 2 - (dock.x - boat.x) * 0.16
    const at = (u: number) => ({
      x: (1 - u) ** 2 * boat.x + 2 * (1 - u) * u * mx + u * u * dock.x,
      y: (1 - u) ** 2 * boat.y + 2 * (1 - u) * u * my + u * u * dock.y,
    })
    c.save()
    c.globalAlpha = k > 0.86 ? (1 - k) / 0.14 : 0.85
    c.strokeStyle = 'rgb(255 255 255 / 0.75)'
    c.lineWidth = 4
    c.lineCap = 'round'
    c.setLineDash([12, 10])
    c.beginPath()
    for (let u = 0; u <= draw; u += 0.02) {
      const p = at(u)
      c.lineTo(p.x, p.y)
    }
    c.stroke()
    c.setLineDash([])
    const tip = at(draw)
    c.fillStyle = 'rgb(255 255 255 / 0.85)'
    c.beginPath()
    c.arc(tip.x, tip.y, 13, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha *= 0.4
    c.beginPath()
    c.arc(tip.x, tip.y, 22, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#061C2A', '#0C3D58')
    drawWater(c)

    for (const dock of activeDocks(state)) drawDock(dock)

    // 항로
    for (const boat of state.boats) {
      if (boat.path.length === 0) continue
      c.save()
      c.strokeStyle = COLORS[boat.color]
      c.globalAlpha = boat === dragging ? 0.95 : 0.55
      c.lineWidth = 4
      c.lineCap = 'round'
      c.setLineDash([12, 10])
      c.beginPath()
      c.moveTo(boat.x, boat.y)
      for (const p of boat.path) c.lineTo(p.x, p.y)
      c.stroke()
      c.setLineDash([])
      const end = boat.path[boat.path.length - 1]
      c.beginPath()
      c.arc(end.x, end.y, 6, 0, Math.PI * 2)
      c.fillStyle = COLORS[boat.color]
      c.fill()
      c.restore()
    }

    drawWarnings(c)
    for (const boat of state.boats) drawBoat(boat, boat === dragging)

    // 부딪힌 종이 조각
    for (const s of scraps) {
      const k = s.age / s.life
      c.save()
      c.globalAlpha = 1 - k * k
      c.translate(s.x, s.y)
      c.rotate(s.rot)
      c.fillStyle = s.color
      c.beginPath()
      c.moveTo(0, -7)
      c.lineTo(7, 4)
      c.lineTo(-6, 6)
      c.closePath()
      c.fill()
      c.restore()
    }

    // 점수 팝업
    for (const pop of state.pops) {
      c.save()
      c.globalAlpha = 1 - pop.age
      c.font = font(30, true)
      c.textAlign = 'center'
      c.lineJoin = 'round'
      c.lineWidth = 6
      c.strokeStyle = 'rgb(6 28 42 / 0.8)'
      c.strokeText(pop.text, pop.x, pop.y - 60 - pop.age * 30)
      c.fillStyle = '#FFECB3'
      c.fillText(pop.text, pop.x, pop.y - 60 - pop.age * 30)
      c.restore()
    }

    if (state.crash) {
      c.save()
      c.globalAlpha = 0.85
      c.strokeStyle = '#FF7043'
      c.lineWidth = 6
      c.beginPath()
      c.arc(state.crash.x, state.crash.y, 34, 0, Math.PI * 2)
      c.stroke()
      c.beginPath()
      c.moveTo(state.crash.x - 20, state.crash.y - 20)
      c.lineTo(state.crash.x + 20, state.crash.y + 20)
      c.moveTo(state.crash.x + 20, state.crash.y - 20)
      c.lineTo(state.crash.x - 20, state.crash.y + 20)
      c.stroke()
      c.restore()
    }

    drawGuide(c)

    // HUD — 배가 화면 위끝에서 나오므로 판을 좁게 잡는다
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: state.combo >= 2,
      compact: true,
    })
    if (state.combo >= 2) {
      c.fillStyle = '#FFD54F'
      c.font = font(26, true)
      c.textAlign = 'center'
      c.fillText(`x${state.combo}`, SCORE_PANEL.cx, SCORE_PANEL.subY)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
