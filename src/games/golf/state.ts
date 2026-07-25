// 미니 골프 퍼즐 — 당겨서 발사, 9홀 코스, 적은 타수일수록 높은 점수

export const FIELD = { left: 60, right: 660, top: 250, bottom: 1150 } as const
export const BALL_R = 14
export const HOLE_R = 24
export const MAX_POWER = 1700
export const STOP_SPEED = 25
export const SINK_SPEED = 420 // 이보다 빠르면 홀을 지나쳐 굴러간다

export interface Wall {
  x: number
  y: number
  w: number
  h: number
}

export interface Level {
  tee: [number, number]
  hole: [number, number]
  walls: Wall[]
}

export const LEVELS: Level[] = [
  { tee: [360, 1050], hole: [360, 360], walls: [] },
  { tee: [360, 1050], hole: [360, 350], walls: [{ x: 60, y: 680, w: 380, h: 36 }] },
  { tee: [160, 1050], hole: [560, 350], walls: [{ x: 340, y: 430, w: 40, h: 500 }] },
  {
    tee: [360, 1050],
    hole: [160, 350],
    walls: [
      { x: 60, y: 660, w: 340, h: 36 },
      { x: 400, y: 400, w: 36, h: 296 },
    ],
  },
  {
    tee: [360, 1050],
    hole: [360, 340],
    walls: [
      { x: 60, y: 800, w: 400, h: 36 },
      { x: 260, y: 540, w: 400, h: 36 },
    ],
  },
  {
    tee: [160, 1050],
    hole: [360, 470],
    walls: [
      { x: 220, y: 330, w: 300, h: 36 },
      { x: 220, y: 330, w: 36, h: 280 },
      { x: 484, y: 330, w: 36, h: 280 },
    ],
  },
  {
    tee: [360, 1050],
    hole: [560, 340],
    walls: [
      { x: 200, y: 900, w: 80, h: 80 },
      { x: 360, y: 700, w: 80, h: 80 },
      { x: 500, y: 500, w: 80, h: 80 },
    ],
  },
  {
    tee: [120, 1050],
    hole: [600, 340],
    walls: [
      { x: 230, y: 430, w: 40, h: 550 },
      { x: 450, y: 250, w: 40, h: 550 },
    ],
  },
  {
    tee: [360, 1080],
    hole: [360, 330],
    walls: [
      { x: 60, y: 880, w: 460, h: 36 },
      { x: 200, y: 640, w: 460, h: 36 },
      { x: 60, y: 420, w: 460, h: 36 },
    ],
  },
]

export type Phase = 'playing' | 'over'

export interface GolfState {
  phase: Phase
  holeIndex: number
  strokes: number
  score: number
  ball: { x: number; y: number; vx: number; vy: number }
  moving: boolean
  aim: { dx: number; dy: number; power: number } | null
  sunkTimer: number // 홀인 연출 후 다음 홀로
  playTime: number // 깃발·힌트 애니메이션용
}

export function currentLevel(state: GolfState): Level {
  return LEVELS[state.holeIndex]
}

export function holePoints(strokes: number): number {
  return Math.max(1, 11 - 2 * strokes)
}

export function createState(): GolfState {
  const [x, y] = LEVELS[0].tee
  return {
    phase: 'playing',
    holeIndex: 0,
    strokes: 0,
    score: 0,
    ball: { x, y, vx: 0, vy: 0 },
    moving: false,
    aim: null,
    sunkTimer: 0,
    playTime: 0,
  }
}

export function loadHole(state: GolfState, index: number) {
  state.holeIndex = index
  state.strokes = 0
  const [x, y] = LEVELS[index].tee
  state.ball = { x, y, vx: 0, vy: 0 }
  state.moving = false
  state.aim = null
}

export interface StepResult {
  sunk: boolean
  bounced: boolean
}

// 공 이동·반사·홀인 판정 (moving일 때만 호출)
export function stepBall(state: GolfState, dt: number): StepResult {
  const ball = state.ball
  const level = currentLevel(state)
  let bounced = false

  let remaining = Math.hypot(ball.vx, ball.vy) * dt
  while (remaining > 0) {
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed < 1) break
    const d = Math.min(10, remaining)
    remaining -= d
    ball.x += (ball.vx / speed) * d
    ball.y += (ball.vy / speed) * d

    if (ball.x < FIELD.left + BALL_R) {
      ball.x = FIELD.left + BALL_R
      ball.vx = Math.abs(ball.vx)
      bounced = true
    } else if (ball.x > FIELD.right - BALL_R) {
      ball.x = FIELD.right - BALL_R
      ball.vx = -Math.abs(ball.vx)
      bounced = true
    }
    if (ball.y < FIELD.top + BALL_R) {
      ball.y = FIELD.top + BALL_R
      ball.vy = Math.abs(ball.vy)
      bounced = true
    } else if (ball.y > FIELD.bottom - BALL_R) {
      ball.y = FIELD.bottom - BALL_R
      ball.vy = -Math.abs(ball.vy)
      bounced = true
    }

    for (const wall of level.walls) {
      const nx = Math.min(Math.max(ball.x, wall.x), wall.x + wall.w)
      const ny = Math.min(Math.max(ball.y, wall.y), wall.y + wall.h)
      const dx = ball.x - nx
      const dy = ball.y - ny
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue
      if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
      else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
      bounced = true
      break
    }

    // 홀인
    const hx = level.hole[0] - ball.x
    const hy = level.hole[1] - ball.y
    if (hx * hx + hy * hy < HOLE_R * HOLE_R && speed < SINK_SPEED) {
      ball.vx = 0
      ball.vy = 0
      state.moving = false
      return { sunk: true, bounced }
    }
  }

  // 마찰 감쇠
  const damp = Math.pow(0.32, dt)
  ball.vx *= damp
  ball.vy *= damp
  if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
    ball.vx = 0
    ball.vy = 0
    state.moving = false
  }
  return { sunk: false, bounced }
}
