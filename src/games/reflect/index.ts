import { t } from '@/shared/i18n'
import { playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { drawScorePanel, font } from '../ui'
import {
  AD_AFTER_FAILS,
  BALL_R,
  BOARD,
  MIN_LINE_LEN,
  RUN_LIMIT,
  abortRun,
  addLine,
  capLine,
  commitLine,
  createState,
  loadLevel,
  launch,
  removeLineAt,
  segDist,
  selectStage,
  update,
  type Seg,
} from './state'

const START_BTN = { x: 160, y: 1096, w: 400, h: 96 } as const
const AD_BTN = { x: 140, y: 1006, w: 440, h: 74 } as const
// 단계 스테퍼는 점수판 안에 든다 — 큰 숫자가 곧 지금 단계다
const PREV_BTN = { x: 156, y: 62, w: 76, h: 72 } as const
const NEXT_BTN = { x: 488, y: 62, w: 76, h: 72 } as const
// 스스로 깬 최고 단계 = 이 게임의 기록. 계정 없이도 이어가도록 즐겨찾기와 같은 localStorage에 둔다
const STAGE_KEY = 'webgame:reflectStage'

function loadCleared(): number {
  const n = Number(localStorage.getItem(STAGE_KEY))
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

// 제도판 위에 선을 긋는 분위기 — 어두운 판이라 두 테마에서 같은 얼굴이다
const INK = {
  outer: '#080E15',
  board: '#0C1622',
  grid: 'rgb(120 170 230 / 0.06)',
  frame: 'rgb(110 165 215 / 0.4)',
  wall: '#DCE6F2',
  line: '#FFB300',
  goal: '#3EE6A8',
} as const

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    for (const b of events.bounces) {
      playSfx('impact', { rate: 0.9 + Math.random() * 0.25 })
      vibrate(6)
      burst(b.x, b.y, 6, 130, INK.line)
    }
    if (events.cleared) {
      playSfx('clear')
      vibrate([20, 40, 30])
      clearGlow = 1
      burst(prevGoal.x, prevGoal.y, 26, 320, INK.goal)
      goalRing = { x: prevGoal.x, y: prevGoal.y, age: 0 }
      adLineUsed = false
      // update()가 이미 다음 단계로 넘겼으므로, 방금 깬 단계는 level - 1이다
      if (state.level - 1 > cleared) {
        cleared = state.level - 1
        localStorage.setItem(STAGE_KEY, String(cleared))
      }
    }
    if (events.failed) {
      playSfx('fail')
      vibrate(60)
      const end = state.lastPath[state.lastPath.length - 1]
      if (end) burst(end.x, end.y, 14, 210, '#EF5350')
    }
    // 클리어 연출이 새 단계 좌표를 쓰지 않도록 매 프레임 현재 목표를 기억해 둔다
    prevGoal = { x: state.goal.x, y: state.goal.y }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  let cleared = loadCleared()
  const state = createState(cleared + 1)
  preloadSfx('clear', 'fail', 'impact', 'pop', 'select', 'shoot', 'tap', 'unlock', 'whoosh')

  const sparks: Spark[] = []
  let goalRing: { x: number; y: number; age: number } | null = null
  let prevGoal = { x: state.goal.x, y: state.goal.y }
  let clearGlow = 0
  let blockedFlash = 0 // 공 자리를 덮는 선을 거절했다는 표시
  let drag: { x1: number; y1: number; x2: number; y2: number; moved: boolean } | null = null
  let adLineUsed = false // 한 단계에 한 번만 — 광고를 반복해서 선을 늘리지는 못한다

  // 이 단계에서 광고 버튼이 보이는 조건. 몇 번 헤맨 뒤에만 나온다 —
  // 처음부터 띄우면 스스로 풀어 볼 기회를 앞질러 뺏는다
  const adReady = () =>
    state.phase === 'placing' &&
    !adLineUsed &&
    state.fails >= AD_AFTER_FAILS &&
    ctx.isRewardAdReady()

  async function watchForLine() {
    if (!adReady()) return
    const rewarded = await ctx.showRewardAd('reflect-line')
    if (shell.isDestroyed() || !rewarded || adLineUsed) return
    adLineUsed = true
    addLine(state)
    playSfx('unlock')
  }

  const burst = (x: number, y: number, count: number, speed: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.6)
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.35 + Math.random() * 0.3,
        r: 2 + Math.random() * 4,
        color,
      })
    }
  }

  const stepEffects = (dt: number) => {
    clearGlow = Math.max(0, clearGlow - dt * 1.4)
    blockedFlash = Math.max(0, blockedFlash - dt * 2.5)
    if (goalRing) {
      goalRing.age += dt
      if (goalRing.age > 0.6) goalRing = null
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]
      p.age += dt
      if (p.age >= p.life) {
        sparks.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 3
      p.vy *= 1 - dt * 3
    }
  }

  const inBoard = (x: number, y: number) =>
    x >= BOARD.x && x <= BOARD.x + BOARD.w && y >= BOARD.y && y <= BOARD.y + BOARD.h
  const clampX = (x: number) => Math.max(BOARD.x + 4, Math.min(BOARD.x + BOARD.w - 4, x))
  const clampY = (y: number) => Math.max(BOARD.y + 4, Math.min(BOARD.y + BOARD.h - 4, y))
  const hitBtn = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

  const canPrev = () => state.phase === 'placing' && state.level > 1
  const canNext = () => state.phase === 'placing' && state.level <= cleared

  const goStage = (delta: number) => {
    if (!selectStage(state, state.level + delta)) return
    adLineUsed = false
    playSfx('tap')
  }

  const tapStart = () => {
    if (state.phase === 'placing') {
      if (launch(state)) {
        playSfx('shoot')
        vibrate(10)
      }
    } else if (state.phase === 'running') {
      if (abortRun(state)) playSfx('whoosh', { rate: 0.7 })
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (hitBtn(START_BTN, p.x, p.y)) {
        tapStart()
        return
      }
      if (adReady() && hitBtn(AD_BTN, p.x, p.y)) {
        void watchForLine()
        return
      }
      // 단계 이동 화살표 — 깬 단계와 그다음 한 칸(지금 푸는 단계)까지만 오간다
      if (state.phase === 'placing' && hitBtn(PREV_BTN, p.x, p.y)) {
        if (canPrev()) goStage(-1)
        return
      }
      if (state.phase === 'placing' && hitBtn(NEXT_BTN, p.x, p.y)) {
        if (canNext()) goStage(1)
        return
      }
      if (state.phase !== 'placing' || !inBoard(p.x, p.y)) return
      drag = { x1: clampX(p.x), y1: clampY(p.y), x2: clampX(p.x), y2: clampY(p.y), moved: false }
    },
    onMove(clientX, clientY) {
      if (!drag) return
      const p = stage.toBoard(clientX, clientY)
      drag.x2 = clampX(p.x)
      drag.y2 = clampY(p.y)
      if (Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1) > 8) drag.moved = true
    },
    onUp(clientX, clientY) {
      if (!drag) return
      const p = stage.toBoard(clientX, clientY)
      drag.x2 = clampX(p.x)
      drag.y2 = clampY(p.y)
      const len = Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1)
      if (!drag.moved || len < MIN_LINE_LEN) {
        // 탭 = 그어 둔 선 지우기
        if (state.phase === 'placing' && removeLineAt(state, drag.x1, drag.y1)) playSfx('pop')
      } else if (state.phase === 'placing') {
        const result = commitLine(state, capLine(drag.x1, drag.y1, drag.x2, drag.y2))
        if (result === 'ok') {
          playSfx('select')
          vibrate(8)
        } else if (result === 'blocked') {
          vibrate(30)
          blockedFlash = 1
        }
      }
      drag = null
    },
  })

  // ─── 그리기 ───

  const drawBoard = (c: CanvasRenderingContext2D) => {
    c.fillStyle = INK.board
    c.beginPath()
    c.roundRect(BOARD.x - 10, BOARD.y - 10, BOARD.w + 20, BOARD.h + 20, 18)
    c.fill()
    // 제도판 모눈
    c.strokeStyle = INK.grid
    c.lineWidth = 1
    c.beginPath()
    for (let x = BOARD.x + 56; x < BOARD.x + BOARD.w; x += 56) {
      c.moveTo(x, BOARD.y)
      c.lineTo(x, BOARD.y + BOARD.h)
    }
    for (let y = BOARD.y + 56; y < BOARD.y + BOARD.h; y += 56) {
      c.moveTo(BOARD.x, y)
      c.lineTo(BOARD.x + BOARD.w, y)
    }
    c.stroke()
    c.strokeStyle = INK.frame
    c.lineWidth = 3
    c.strokeRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h)
  }

  const drawGhostPath = (c: CanvasRenderingContext2D) => {
    if (state.lastPath.length < 2) return
    c.strokeStyle = 'rgb(255 255 255 / 0.11)'
    c.lineWidth = 3
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(state.lastPath[0].x, state.lastPath[0].y)
    for (const p of state.lastPath) c.lineTo(p.x, p.y)
    c.stroke()
  }

  const drawWalls = (c: CanvasRenderingContext2D) => {
    c.lineCap = 'round'
    for (const w of state.walls) {
      c.strokeStyle = 'rgb(220 230 242 / 0.16)'
      c.lineWidth = 19
      c.beginPath()
      c.moveTo(w.x1, w.y1)
      c.lineTo(w.x2, w.y2)
      c.stroke()
      c.strokeStyle = INK.wall
      c.lineWidth = 10
      c.beginPath()
      c.moveTo(w.x1, w.y1)
      c.lineTo(w.x2, w.y2)
      c.stroke()
    }
  }

  const drawGoal = (c: CanvasRenderingContext2D) => {
    const g = state.goal
    const pulse = 1 + Math.sin(state.playTime * 2.6) * 0.05
    c.save()
    c.fillStyle = 'rgb(62 230 168 / 0.13)'
    c.beginPath()
    c.arc(g.x, g.y, g.r * pulse, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = INK.goal
    c.lineWidth = 5
    c.beginPath()
    c.arc(g.x, g.y, g.r * pulse, 0, Math.PI * 2)
    c.stroke()
    c.globalAlpha = 0.55
    c.lineWidth = 2.5
    c.beginPath()
    c.arc(g.x, g.y, g.r * 0.62, 0, Math.PI * 2)
    c.stroke()
    c.globalAlpha = 1
    c.fillStyle = INK.goal
    c.beginPath()
    c.arc(g.x, g.y, 5, 0, Math.PI * 2)
    c.fill()
    c.restore()
    if (goalRing) {
      const k = goalRing.age / 0.6
      c.save()
      c.globalAlpha = 1 - k
      c.strokeStyle = INK.goal
      c.lineWidth = 6 * (1 - k)
      c.beginPath()
      c.arc(goalRing.x, goalRing.y, 40 + k * 130, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }
  }

  const strokeLine = (c: CanvasRenderingContext2D, s: Seg, alpha: number) => {
    c.save()
    c.globalAlpha = alpha
    c.lineCap = 'round'
    c.strokeStyle = 'rgb(255 179 0 / 0.22)'
    c.lineWidth = 20
    c.beginPath()
    c.moveTo(s.x1, s.y1)
    c.lineTo(s.x2, s.y2)
    c.stroke()
    c.strokeStyle = INK.line
    c.lineWidth = 8
    c.beginPath()
    c.moveTo(s.x1, s.y1)
    c.lineTo(s.x2, s.y2)
    c.stroke()
    c.fillStyle = '#FFD54F'
    c.beginPath()
    c.arc(s.x1, s.y1, 6, 0, Math.PI * 2)
    c.arc(s.x2, s.y2, 6, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const drawPreview = (c: CanvasRenderingContext2D) => {
    if (!drag || !drag.moved) return
    const seg = capLine(drag.x1, drag.y1, drag.x2, drag.y2)
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1)
    const blocked = segDist(seg, state.spawn.x, state.spawn.y) < BALL_R + 16
    if (len < MIN_LINE_LEN || blocked) {
      c.save()
      c.strokeStyle = blocked ? 'rgb(239 83 80 / 0.75)' : 'rgb(255 255 255 / 0.35)'
      c.lineWidth = 5
      c.lineCap = 'round'
      c.setLineDash([10, 12])
      c.beginPath()
      c.moveTo(seg.x1, seg.y1)
      c.lineTo(seg.x2, seg.y2)
      c.stroke()
      c.restore()
      return
    }
    strokeLine(c, seg, 0.65)
  }

  const drawTrail = (c: CanvasRenderingContext2D) => {
    const path = state.runPath
    if (state.phase !== 'running' || path.length < 2) return
    const from = Math.max(0, path.length - 16)
    c.save()
    c.lineCap = 'round'
    for (let i = from + 1; i < path.length; i++) {
      const k = (i - from) / (path.length - from)
      c.globalAlpha = k * 0.35
      c.strokeStyle = '#FFCC80'
      c.lineWidth = 2 + k * 7
      c.beginPath()
      c.moveTo(path[i - 1].x, path[i - 1].y)
      c.lineTo(path[i].x, path[i].y)
      c.stroke()
    }
    c.restore()
  }

  const drawBall = (c: CanvasRenderingContext2D) => {
    const b = state.ball
    c.save()
    const glow = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, BALL_R * 2.6)
    glow.addColorStop(0, 'rgb(255 183 77 / 0.5)')
    glow.addColorStop(1, 'rgb(255 183 77 / 0)')
    c.fillStyle = glow
    c.beginPath()
    c.arc(b.x, b.y, BALL_R * 2.6, 0, Math.PI * 2)
    c.fill()
    const body = c.createRadialGradient(b.x - 4, b.y - 5, 2, b.x, b.y, BALL_R)
    body.addColorStop(0, '#FFF3E0')
    body.addColorStop(0.6, '#FFB74D')
    body.addColorStop(1, '#F57C00')
    c.fillStyle = body
    c.beginPath()
    c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2)
    c.fill()
    // 공 자리를 덮는 선을 거절했을 때 붉은 테로 이유를 알려 준다
    if (blockedFlash > 0) {
      c.globalAlpha = blockedFlash
      c.strokeStyle = '#EF5350'
      c.lineWidth = 4
      c.beginPath()
      c.arc(b.x, b.y, BALL_R + 8, 0, Math.PI * 2)
      c.stroke()
      c.globalAlpha = 1
    }
    // 배치 중에는 어디로 쏠지 화살표로 보여 준다 — 경로 전체는 보여주지 않는다
    if (state.phase === 'placing') {
      const { dx, dy } = state.spawn
      const ax = b.x + dx * (BALL_R + 10)
      const ay = b.y + dy * (BALL_R + 10)
      const tipX = b.x + dx * (BALL_R + 46)
      const tipY = b.y + dy * (BALL_R + 46)
      c.globalAlpha = 0.55 + Math.sin(state.playTime * 3) * 0.25
      c.strokeStyle = '#FFE0B2'
      c.lineWidth = 5
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(ax, ay)
      c.lineTo(tipX, tipY)
      c.stroke()
      c.fillStyle = '#FFE0B2'
      c.beginPath()
      c.moveTo(tipX + dx * 14, tipY + dy * 14)
      c.lineTo(tipX - dy * 8, tipY + dx * 8)
      c.lineTo(tipX + dy * 8, tipY - dx * 8)
      c.closePath()
      c.fill()
    }
    c.restore()
  }

  const drawSparks = (c: CanvasRenderingContext2D) => {
    for (const p of sparks) {
      const k = p.age / p.life
      c.globalAlpha = (1 - k) * 0.9
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  const drawTimeBar = (c: CanvasRenderingContext2D) => {
    if (state.phase !== 'running') return
    const left = Math.max(0, 1 - state.runTime / RUN_LIMIT)
    c.fillStyle = left * RUN_LIMIT < 3 ? '#EF5350' : INK.line
    c.fillRect(BOARD.x, BOARD.y - 10, BOARD.w * left, 6)
  }

  const drawChevron = (
    c: CanvasRenderingContext2D,
    btn: { x: number; y: number; w: number; h: number },
    dir: 1 | -1,
    enabled: boolean,
  ) => {
    const cx = btn.x + btn.w / 2
    const cy = btn.y + btn.h / 2
    c.strokeStyle = enabled ? '#FFFFFF' : 'rgb(255 255 255 / 0.18)'
    c.lineWidth = 6
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(cx - dir * 7, cy - 13)
    c.lineTo(cx + dir * 7, cy)
    c.lineTo(cx - dir * 7, cy + 13)
    c.stroke()
  }

  const drawHud = (c: CanvasRenderingContext2D) => {
    // 이 게임의 기록은 점수가 아니라 단계다 — 큰 숫자가 지금 단계이고,
    // 머리줄의 '최고 N'이 지금까지 깬 단계다 (신기록 불빛도 그대로 붙는다)
    drawScorePanel(c, { label: t('rf.stage'), value: String(state.level) })
    drawChevron(c, PREV_BTN, -1, canPrev())
    drawChevron(c, NEXT_BTN, 1, canNext())

    // 그을 수 있는 선 자리 — 밝은 빗금이 남은 몫이다
    for (let i = 0; i < state.maxLines; i++) {
      const x = 676 - i * 42
      const remaining = i < state.maxLines - state.lines.length
      c.strokeStyle = remaining ? INK.line : 'rgb(255 255 255 / 0.22)'
      c.lineWidth = 6
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(x - 12, 208)
      c.lineTo(x + 12, 188)
      c.stroke()
    }
  }

  const drawAdButton = (c: CanvasRenderingContext2D) => {
    if (!adReady()) return
    c.fillStyle = '#43A047'
    c.beginPath()
    c.roundRect(AD_BTN.x, AD_BTN.y, AD_BTN.w, AD_BTN.h, 22)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(25, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(t('rf.adLine'), AD_BTN.x + AD_BTN.w / 2, AD_BTN.y + AD_BTN.h / 2 + 1)
    c.textBaseline = 'alphabetic'
  }

  const drawStartButton = (c: CanvasRenderingContext2D) => {
    const running = state.phase === 'running'
    c.fillStyle = running ? 'rgb(255 255 255 / 0.16)' : '#43A047'
    c.beginPath()
    c.roundRect(START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, 26)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(30, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(
      running ? t('rf.abort') : t('rf.start'),
      START_BTN.x + START_BTN.w / 2,
      START_BTN.y + START_BTN.h / 2 + 1,
    )
    c.textBaseline = 'alphabetic'
  }

  // 글자 없는 조작 안내 — 첫 단계에서 아직 선을 안 그었으면 손끝이 선을 긋는 시늉을 한다
  const drawHint = (c: CanvasRenderingContext2D) => {
    if (state.level !== 1 || state.lines.length > 0 || state.phase !== 'placing' || drag) return
    const k = (state.playTime % 1.8) / 1.8
    const run = Math.min(1, k / 0.66)
    const x0 = 230
    const y0 = 830
    const x1 = x0 + run * 200
    const y1 = y0 - run * 130
    c.save()
    c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 0.7
    c.strokeStyle = '#4DD0E1'
    c.lineWidth = 7
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(x0, y0)
    c.lineTo(x1, y1)
    c.stroke()
    c.fillStyle = 'rgb(224 247 250 / 0.9)'
    c.beginPath()
    c.arc(x1, y1, 15, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin(INK.outer, INK.outer)
    drawBoard(c)
    drawGhostPath(c)
    drawWalls(c)
    drawGoal(c)
    for (const s of state.lines) strokeLine(c, s, 1)
    drawPreview(c)
    drawTrail(c)
    drawBall(c)
    drawSparks(c)
    drawTimeBar(c)

    if (clearGlow > 0) {
      c.fillStyle = `rgb(210 255 235 / ${clearGlow * 0.22})`
      c.fillRect(0, 0, 720, 1280)
    }

    drawHud(c)
    drawAdButton(c)
    drawStartButton(c)
    drawHint(c)

    if (state.clearFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, state.clearFlash / 0.4)
      c.fillStyle = 'rgb(0 0 0 / 0.6)'
      c.fillRect(0, 600, 720, 120)
      c.fillStyle = '#69F0AE'
      c.font = font(40, true)
      c.textAlign = 'center'
      c.fillText(t('rf.clear'), 360, 676)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return {
    destroy: () => shell.destroy(),
    // 랭킹에 오르는 값 = 스스로 깬 최고 단계
    getScore: () => cleared,
    // 관리자 전용 '다음 단계' — 넘긴 단계는 깬 것으로 세지 않는다 (기록은 그대로)
    adminSkip() {
      state.level += 1
      loadLevel(state)
      adLineUsed = false
    },
  }
}

export default defineGame(createSession)
