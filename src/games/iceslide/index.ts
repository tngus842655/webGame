import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  CELL,
  COLS,
  ROWS,
  X0,
  Y0,
  addMoves,
  canUndo,
  createState,
  restart,
  slide,
  undo,
  update,
  type Dir,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconValue } from '../icons'

const SWIPE_THRESHOLD = 40
const UNDO_BTN = { x: 44, y: 1112, w: 336, h: 88 } as const
const RESTART_BTN = { x: 396, y: 1112, w: 280, h: 88 } as const
const BOARD_W = COLS * CELL
const BOARD_H = ROWS * CELL

const centerX = (cx: number) => X0 + cx * CELL + CELL / 2
const centerY = (cy: number) => Y0 + cy * CELL + CELL / 2

// 얼음의 금과 눈밭의 굴곡 — 판마다 같은 무늬를 쓰려고 모듈을 읽을 때 한 번만 만든다
const CRACKS = Array.from({ length: 14 }, () => {
  const x = X0 + Math.random() * BOARD_W
  const y = Y0 + Math.random() * BOARD_H
  const a = Math.random() * Math.PI
  const len = 30 + Math.random() * 70
  return { x, y, dx: Math.cos(a) * len, dy: Math.sin(a) * len, bend: (Math.random() - 0.5) * 26 }
})
const BERGS = Array.from({ length: 6 }, (_, i) => ({
  x: 40 + i * 128 + (i % 2) * 40,
  w: 90 + (i % 3) * 46,
  h: 42 + (i % 4) * 22,
}))

interface Crystal {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const wasSliding = state.phase === 'sliding'
    const events = update(state, dt)
    if (events.stars > 0) {
      playSfx('coin', { rate: 1 + Math.min(4, events.stars - 1) * 0.06 })
      vibrate(12)
      // 지나가며 주웠으므로 펭귄 자리에서 튀어오른다
      const sl = state.slide
      const px = sl ? lerpX(sl.fromX, sl.toX, ease(sl.t)) : centerX(state.px)
      const py = sl ? lerpY(sl.fromY, sl.toY, ease(sl.t)) : centerY(state.py)
      for (let i = 0; i < events.stars; i++) starPops.push({ x: px, y: py, age: 0 })
      sparkle(px, py)
    }
    if (events.cleared) {
      playSfx('clear')
      vibrate([20, 40, 30])
      clearGlow = 1
    } else if (events.stopped) {
      playSfx('impact')
      bump = 1
      shake = 1
      // 부딪혀 멈춘 자리에서 얼음이 튄다
      crash(centerX(state.px), centerY(state.py))
    }
    if (wasSliding) trailAge = 0
    else trailAge = Math.min(1, trailAge + dt * 1.1)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'coin', 'gameover', 'ice-slide', 'impact', 'whoosh')
  const crystals: Crystal[] = []
  const starPops: Array<{ x: number; y: number; age: number }> = []
  // 방금 지나온 길 — 얼음 위에 자국이 잠깐 남는다
  let trail: { fromX: number; fromY: number; toX: number; toY: number } | null = null
  let trailAge = 1
  let bump = 0
  let shake = 0
  let clearGlow = 0
  let blocked = 0 // 벽에 붙어 못 움직인 방향 표시
  let blockedDir: Dir = 'down'
  let swipeStart: { x: number; y: number } | null = null
  let adMovesUsed = false

  const ease = (t: number) => 1 - (1 - t) * (1 - t)
  const lerpX = (a: number, b: number, k: number) => centerX(a) + (centerX(b) - centerX(a)) * k
  const lerpY = (a: number, b: number, k: number) => centerY(a) + (centerY(b) - centerY(a)) * k

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ic.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adMovesUsed = false
      Object.assign(state, createState())
      crystals.length = 0
      starPops.length = 0
      trail = null
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adMovesUsed) return
    const rewarded = await ctx.showRewardAd('iceslide-moves')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adMovesUsed = true
    addMoves(state, 5)
    overlay.hide()
  }

  // 공짜 되돌리기를 다 쓰면 광고로 한 번 더
  async function undoWithAd() {
    if (!canUndo(state)) return
    const rewarded = await ctx.showRewardAd('iceslide-undo')
    if (shell.isDestroyed() || !rewarded) return
    if (undo(state)) playSfx('whoosh', { rate: 0.8 })
  }

  const tapUndo = () => {
    if (!canUndo(state)) return
    if (state.freeUndo > 0) {
      state.freeUndo -= 1
      if (undo(state)) playSfx('whoosh', { rate: 0.8 })
      return
    }
    if (ctx.isRewardAdReady()) void undoWithAd()
  }

  // 다시하기도 되돌리기 몫을 하나 쓴다 — 공짜로 무한히 접을 수 있으면 실수에 값이 없다
  const tapRestart = () => {
    if (state.phase !== 'playing' || state.freeUndo <= 0 || state.history.length === 0) return
    if (!restart(state)) return
    state.freeUndo -= 1
    playSfx('whoosh', { rate: 0.62 })
    vibrate(20)
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adMovesUsed, 'over.byMoves')
  }

  const pushCrystal = (x: number, y: number, vx: number, vy: number, life: number) => {
    crystals.push({ x, y, vx, vy, age: 0, life, r: 2 + Math.random() * 5 })
  }

  const crash = (x: number, y: number) => {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 90 + Math.random() * 230
      pushCrystal(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.45)
    }
  }

  const sparkle = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 70 + Math.random() * 160
      pushCrystal(x, y, Math.cos(a) * v, Math.sin(a) * v - 60, 0.5)
    }
  }

  const stepEffects = (dt: number) => {
    bump = Math.max(0, bump - dt * 4)
    shake = Math.max(0, shake - dt * 5)
    clearGlow = Math.max(0, clearGlow - dt * 1.4)
    blocked = Math.max(0, blocked - dt * 3)
    // 미끄러지는 동안 뒤로 얼음 가루가 뿌려진다
    const sl = state.slide
    if (sl && sl.t < 1) {
      const k = ease(sl.t)
      const x = lerpX(sl.fromX, sl.toX, k)
      const y = lerpY(sl.fromY, sl.toY, k)
      const dx = Math.sign(sl.toX - sl.fromX)
      const dy = Math.sign(sl.toY - sl.fromY)
      for (let i = 0; i < 2; i++) {
        pushCrystal(
          x - dx * 22 + (Math.random() - 0.5) * 20,
          y - dy * 22 + (Math.random() - 0.5) * 20,
          -dx * (60 + Math.random() * 120) + (Math.random() - 0.5) * 90,
          -dy * (60 + Math.random() * 120) + (Math.random() - 0.5) * 90,
          0.4,
        )
      }
    }
    for (let i = crystals.length - 1; i >= 0; i--) {
      const p = crystals[i]
      p.age += dt
      if (p.age >= p.life) {
        crystals.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 3
      p.vy *= 1 - dt * 3
    }
    for (let i = starPops.length - 1; i >= 0; i--) {
      starPops[i].age += dt
      if (starPops[i].age > 0.8) starPops.splice(i, 1)
    }
  }

  const trySwipe = (clientX: number, clientY: number) => {
    if (!swipeStart || state.phase !== 'playing') return
    const p = stage.toBoard(clientX, clientY)
    const dx = p.x - swipeStart.x
    const dy = p.y - swipeStart.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return
    swipeStart = null
    let dir: Dir
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left'
    else dir = dy > 0 ? 'down' : 'up'
    if (slide(state, dir)) {
      playSfx('ice-slide')
      trail = { fromX: state.slide!.fromX, fromY: state.slide!.fromY, toX: state.px, toY: state.py }
      trailAge = 0
    } else {
      // 그쪽은 막혀 있다 — 진동만으로는 왜 안 갔는지 모른다
      vibrate(30)
      blocked = 1
      blockedDir = dir
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (
        p.x >= UNDO_BTN.x &&
        p.x <= UNDO_BTN.x + UNDO_BTN.w &&
        p.y >= UNDO_BTN.y &&
        p.y <= UNDO_BTN.y + UNDO_BTN.h
      ) {
        tapUndo()
        return
      }
      if (
        p.x >= RESTART_BTN.x &&
        p.x <= RESTART_BTN.x + RESTART_BTN.w &&
        p.y >= RESTART_BTN.y &&
        p.y <= RESTART_BTN.y + RESTART_BTN.h
      ) {
        tapRestart()
        return
      }
      if (state.phase !== 'playing') return
      swipeStart = p
    },
    onMove: trySwipe,
    onUp(clientX, clientY) {
      trySwipe(clientX, clientY)
      swipeStart = null
    },
  })

  const drawStar = (cx: number, cy: number, r: number, spin: number) => {
    const c = stage.c
    c.save()
    c.translate(cx, cy)
    c.rotate(spin)
    c.fillStyle = 'rgb(0 0 0 / 0.16)'
    c.beginPath()
    c.ellipse(2, r * 0.9, r * 0.7, r * 0.24, 0, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 === 0 ? r : r * 0.44
      const x = Math.cos(a) * rad
      const y = Math.sin(a) * rad
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
    const grad = c.createLinearGradient(-r, -r, r, r)
    grad.addColorStop(0, '#FFF3C4')
    grad.addColorStop(0.5, '#FFCA28')
    grad.addColorStop(1, '#F57F17')
    c.fillStyle = grad
    c.fill()
    c.strokeStyle = '#E08C00'
    c.lineWidth = 2
    c.stroke()
    c.fillStyle = 'rgb(255 255 255 / 0.75)'
    c.beginPath()
    c.moveTo(0, -r * 0.86)
    c.lineTo(r * 0.2, -r * 0.24)
    c.lineTo(0, -r * 0.1)
    c.lineTo(-r * 0.2, -r * 0.24)
    c.closePath()
    c.fill()
    c.restore()
  }

  // 눈 덮인 바위 — 둥근 사각형 하나였던 것을 깎인 면이 있는 돌덩이로
  const drawRock = (px: number, py: number) => {
    const c = stage.c
    const x = px + CELL / 2
    const y = py + CELL / 2
    const r = CELL * 0.4
    c.save()
    c.fillStyle = 'rgb(40 70 90 / 0.25)'
    c.beginPath()
    c.ellipse(x, y + r * 0.78, r * 0.94, r * 0.28, 0, 0, Math.PI * 2)
    c.fill()

    const body = c.createLinearGradient(x - r, y - r, x + r, y + r)
    body.addColorStop(0, '#8FA3AF')
    body.addColorStop(0.55, '#61798A')
    body.addColorStop(1, '#3E5361')
    c.fillStyle = body
    c.beginPath()
    c.moveTo(x - r, y + r * 0.62)
    c.lineTo(x - r * 0.82, y - r * 0.26)
    c.lineTo(x - r * 0.28, y - r * 0.82)
    c.lineTo(x + r * 0.5, y - r * 0.7)
    c.lineTo(x + r, y + r * 0.1)
    c.lineTo(x + r * 0.72, y + r * 0.7)
    c.closePath()
    c.fill()

    // 위에 쌓인 눈
    c.fillStyle = '#F4FAFD'
    c.beginPath()
    c.moveTo(x - r * 0.82, y - r * 0.26)
    c.lineTo(x - r * 0.28, y - r * 0.82)
    c.lineTo(x + r * 0.5, y - r * 0.7)
    c.lineTo(x + r * 0.66, y - r * 0.34)
    c.quadraticCurveTo(x, y - r * 0.06, x - r * 0.82, y - r * 0.26)
    c.closePath()
    c.fill()
    // 갈라진 금
    c.strokeStyle = 'rgb(30 45 55 / 0.35)'
    c.lineWidth = 2.5
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(x + r * 0.16, y - r * 0.06)
    c.lineTo(x + r * 0.34, y + r * 0.34)
    c.stroke()
    c.restore()
  }

  // 펭귄 — 미끄러지는 동안은 배를 깔고 눕는다
  const drawPenguin = (x: number, y: number, sliding: boolean) => {
    const c = stage.c
    const facing = state.facing
    const [dx, dy] =
      facing === 'left' ? [-1, 0] : facing === 'right' ? [1, 0] : [0, facing === 'up' ? -0.6 : 0.6]

    c.save()
    c.fillStyle = 'rgb(40 70 90 / 0.22)'
    c.beginPath()
    c.ellipse(x, y + 30, 30, 10, 0, 0, Math.PI * 2)
    c.fill()
    c.translate(x, y)
    // 부딪힌 순간 납작해졌다가 돌아온다
    if (bump > 0) c.scale(1 + bump * 0.16, 1 - bump * 0.14)
    // 미끄러지는 동안은 진행 방향으로 몸이 늘어난다
    if (sliding) {
      const stretch = Math.abs(dx) > Math.abs(dy) ? [1.16, 0.9] : [0.9, 1.16]
      c.scale(stretch[0], stretch[1])
    }

    // 날개 — 미끄러질 때는 뒤로 젖혀진다
    c.fillStyle = '#1B262C'
    for (const side of [-1, 1]) {
      c.save()
      c.rotate(sliding ? -side * dx * 0.5 : 0)
      c.beginPath()
      c.ellipse(side * 27, sliding ? 4 : 8, 9, 19, side * 0.35, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    // 몸통
    const body = c.createLinearGradient(-26, -30, 26, 30)
    body.addColorStop(0, '#3C4C56')
    body.addColorStop(0.5, '#263238')
    body.addColorStop(1, '#141D22')
    c.fillStyle = body
    c.beginPath()
    c.arc(0, 0, 31, 0, Math.PI * 2)
    c.fill()
    // 배
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.ellipse(dx * 6, dy * 5 + 4, 18, 21, 0, 0, Math.PI * 2)
    c.fill()
    // 발
    c.fillStyle = '#EF6C00'
    for (const side of [-1, 1]) {
      c.beginPath()
      c.ellipse(side * 11, 29, 8, 5, side * 0.3, 0, Math.PI * 2)
      c.fill()
    }
    // 부리는 보는 쪽으로
    c.fillStyle = '#FB8C00'
    c.beginPath()
    c.moveTo(dx * 30, dy * 26)
    c.lineTo(dx * 14 - dy * 9, dy * 14 - dx * 9)
    c.lineTo(dx * 14 + dy * 9, dy * 14 + dx * 9)
    c.closePath()
    c.fill()
    // 눈
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(-9, -12, 6.5, 0, Math.PI * 2)
    c.arc(9, -12, 6.5, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#0D1B22'
    c.beginPath()
    c.arc(-9 + dx * 2, -12 + dy * 2, 3.2, 0, Math.PI * 2)
    c.arc(9 + dx * 2, -12 + dy * 2, 3.2, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#0A2334')
    sky.addColorStop(0.35, '#154257')
    sky.addColorStop(1, '#0C2F42')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)
    // 오로라
    c.save()
    const aurora = c.createLinearGradient(0, 60, 0, 250)
    aurora.addColorStop(0, 'rgb(80 220 190 / 0)')
    aurora.addColorStop(0.5, 'rgb(90 230 180 / 0.14)')
    aurora.addColorStop(1, 'rgb(120 160 255 / 0)')
    c.fillStyle = aurora
    c.beginPath()
    c.moveTo(0, 90)
    for (let x = 0; x <= 720; x += 40) {
      c.lineTo(x, 120 + Math.sin(x / 110 + state.playTime * 0.5) * 26)
    }
    c.lineTo(720, 250)
    c.lineTo(0, 250)
    c.closePath()
    c.fill()
    c.restore()
    // 멀리 늘어선 빙산
    c.fillStyle = 'rgb(190 225 240 / 0.16)'
    for (const b of BERGS) {
      c.beginPath()
      c.moveTo(b.x - b.w / 2, Y0 - 14)
      c.lineTo(b.x, Y0 - 14 - b.h)
      c.lineTo(b.x + b.w / 2, Y0 - 14)
      c.closePath()
      c.fill()
    }
    // 얼음판이 놓인 눈밭
    c.fillStyle = '#E8F4F9'
    c.beginPath()
    c.roundRect(X0 - 16, Y0 - 16, BOARD_W + 32, BOARD_H + 32, 24)
    c.fill()
  }

  const drawIce = (c: CanvasRenderingContext2D) => {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = X0 + x * CELL
        const py = Y0 + y * CELL
        c.fillStyle = (x + y) % 2 === 0 ? '#DCF0F8' : '#C7E4F1'
        c.fillRect(px, py, CELL, CELL)
      }
    }
    c.save()
    c.beginPath()
    c.rect(X0, Y0, BOARD_W, BOARD_H)
    c.clip()
    // 얼음의 금
    c.strokeStyle = 'rgb(255 255 255 / 0.7)'
    c.lineWidth = 2
    c.lineCap = 'round'
    for (const k of CRACKS) {
      c.beginPath()
      c.moveTo(k.x, k.y)
      c.quadraticCurveTo(k.x + k.dx / 2 + k.bend, k.y + k.dy / 2 - k.bend, k.x + k.dx, k.y + k.dy)
      c.stroke()
    }
    // 비스듬히 지나는 광택
    const gloss = c.createLinearGradient(X0, Y0, X0 + BOARD_W, Y0 + BOARD_H)
    gloss.addColorStop(0, 'rgb(255 255 255 / 0.22)')
    gloss.addColorStop(0.4, 'rgb(255 255 255 / 0)')
    gloss.addColorStop(0.75, 'rgb(255 255 255 / 0.16)')
    gloss.addColorStop(1, 'rgb(255 255 255 / 0)')
    c.fillStyle = gloss
    c.fillRect(X0, Y0, BOARD_W, BOARD_H)

    // 방금 지나온 자국
    if (trail && trailAge < 1) {
      c.save()
      c.globalAlpha = (1 - trailAge) * 0.55
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 34
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(centerX(trail.fromX), centerY(trail.fromY))
      c.lineTo(centerX(trail.toX), centerY(trail.toY))
      c.stroke()
      c.restore()
    }
    c.restore()

    // 칸 선은 옅게 — 칸 세기가 이 게임의 계산이라 지우지는 않는다
    c.strokeStyle = 'rgb(255 255 255 / 0.5)'
    c.lineWidth = 1
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        c.strokeRect(X0 + x * CELL + 0.5, Y0 + y * CELL + 0.5, CELL - 1, CELL - 1)
      }
    }
    // 판 테두리 — 얼음 덩어리의 두께
    c.strokeStyle = 'rgb(120 170 195 / 0.6)'
    c.lineWidth = 4
    c.strokeRect(X0, Y0, BOARD_W, BOARD_H)
  }

  const draw = () => {
    const c = stage.begin('#071A26', '#0B2A3A')
    drawBackdrop(c)

    c.save()
    if (shake > 0) c.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake)

    drawIce(c)

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x
        const px = X0 + x * CELL
        const py = Y0 + y * CELL
        if (state.rocks[i]) drawRock(px, py)
        else if (state.stars[i]) {
          const bobY = Math.sin(state.playTime * 2.4 + i) * 3
          drawStar(px + CELL / 2, py + CELL / 2 + bobY, 26, Math.sin(state.playTime * 1.2 + i) * 0.2)
        }
      }
    }

    // 얼음 가루
    for (const p of crystals) {
      const k = p.age / p.life
      c.globalAlpha = (1 - k) * 0.9
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 - k * 0.4), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    const sl = state.slide
    const pxPos = sl ? lerpX(sl.fromX, sl.toX, ease(sl.t)) : centerX(state.px)
    const pyPos = sl ? lerpY(sl.fromY, sl.toY, ease(sl.t)) : centerY(state.py)
    drawPenguin(pxPos, pyPos, sl !== null)

    // 그쪽은 막혀 있다는 표시
    if (blocked > 0) {
      const [bx, by] =
        blockedDir === 'left'
          ? [-1, 0]
          : blockedDir === 'right'
            ? [1, 0]
            : [0, blockedDir === 'up' ? -1 : 1]
      c.save()
      c.globalAlpha = blocked * 0.8
      c.strokeStyle = '#EF5350'
      c.lineWidth = 7
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(pxPos + bx * 40 - by * 18, pyPos + by * 40 - bx * 18)
      c.lineTo(pxPos + bx * 40 + by * 18, pyPos + by * 40 + bx * 18)
      c.stroke()
      c.restore()
    }

    // 주운 별
    c.textAlign = 'center'
    c.font = font(26, true)
    for (const p of starPops) {
      const k = p.age / 0.8
      c.save()
      c.globalAlpha = 1 - k * k
      c.lineJoin = 'round'
      c.lineWidth = 6
      c.strokeStyle = 'rgb(7 26 38 / 0.8)'
      c.strokeText('+50', p.x, p.y - 34 - k * 40)
      c.fillStyle = '#FFD54F'
      c.fillText('+50', p.x, p.y - 34 - k * 40)
      c.restore()
    }
    c.restore()

    if (clearGlow > 0) {
      c.fillStyle = `rgb(255 250 220 / ${clearGlow * 0.3})`
      c.fillRect(0, 0, 720, 1280)
    }

    // HUD — 판이 y 250부터라 공통 점수판이 그대로 들어간다
    drawScorePanel(c, {
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.font = font(20)
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('ic.level', { n: state.level }), SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 남은 이동이 곧 수명이라 크게 보여 준다
    c.textAlign = 'left'
    c.fillStyle = state.moves <= 3 ? '#FF8A65' : '#FFFFFF'
    c.font = font(30, true)
    c.fillText(t('ic.moves', { n: state.moves }), 30, 214)
    c.fillStyle = '#FFCA28'
    drawIconValue(c, 'star', String(state.starsLeft), 690, 204, 15, 'right')
    c.textAlign = 'center'

    // 되돌리기 버튼 (공짜가 남았으면 회색, 다 쓰면 광고 버튼)
    const undoReady = canUndo(state)
    const useAd = state.freeUndo === 0
    if (undoReady && (!useAd || ctx.isRewardAdReady())) {
      c.fillStyle = useAd ? '#43A047' : 'rgb(255 255 255 / 0.16)'
      c.beginPath()
      c.roundRect(UNDO_BTN.x, UNDO_BTN.y, UNDO_BTN.w, UNDO_BTN.h, 22)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(25, true)
      c.textBaseline = 'middle'
      c.fillText(
        useAd ? t('ic.undoAd') : t('ic.undo', { n: state.freeUndo }),
        UNDO_BTN.x + UNDO_BTN.w / 2,
        UNDO_BTN.y + UNDO_BTN.h / 2 + 1,
      )
      c.textBaseline = 'alphabetic'
    }

    // 판 다시하기 — 되돌리기 몫이 남아 있고 한 수라도 뒀을 때만
    if (undoReady && state.freeUndo > 0) {
      c.fillStyle = 'rgb(255 255 255 / 0.16)'
      c.beginPath()
      c.roundRect(RESTART_BTN.x, RESTART_BTN.y, RESTART_BTN.w, RESTART_BTN.h, 22)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(25, true)
      c.textBaseline = 'middle'
      c.fillText(
        t('ic.restart'),
        RESTART_BTN.x + RESTART_BTN.w / 2,
        RESTART_BTN.y + RESTART_BTN.h / 2 + 1,
      )
      c.textBaseline = 'alphabetic'
    }

    // 글자 없는 조작 안내 — 첫 판에서 아직 한 번도 안 밀었으면 손끝이 쓸어 보인다
    if (state.level === 1 && state.history.length === 0 && state.phase === 'playing') {
      const k = (state.playTime % 1.8) / 1.8
      const run = Math.min(1, k / 0.66)
      const sx = pxPos + 54
      const c0 = { x: sx, y: pyPos }
      const tip = { x: sx + run * 120, y: pyPos }
      c.save()
      c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 0.7
      c.strokeStyle = '#4DD0E1'
      c.lineWidth = 7
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(c0.x, c0.y)
      c.lineTo(tip.x, tip.y)
      c.stroke()
      c.fillStyle = 'rgb(224 247 250 / 0.9)'
      c.beginPath()
      c.arc(tip.x, tip.y, 15, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    if (state.clearFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, state.clearFlash / 0.4)
      c.fillStyle = 'rgb(0 0 0 / 0.6)'
      c.fillRect(0, 600, 720, 120)
      c.fillStyle = '#FFD54F'
      c.font = font(40, true)
      c.textAlign = 'center'
      c.fillText(t('ic.clear', { n: state.clearGain }), 360, 676)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
