// 한 줄로 골인 — 공은 스스로 굴러가고, 플레이어는 선을 그어 튕겨서 목표 고리에 넣는다.
// 배치 후 실행: 선을 놓고 발사 → 지켜보고 → 실패하면 선을 고쳐 다시 쏜다.
//
// 판은 역산으로 만든다: 가상의 플레이어 선을 놓고 공을 굴려 본 뒤, 가상 선에
// 튕긴 다음 지나는 경로 위의 한 점을 목표로 삼고 가상 선을 지운다. 그 배치를
// 그대로 그으면 반드시 풀리므로 풀 수 없는 판이 나오지 않는다. 선을 안 그어도
// 들어가는 판은 자연 경로를 따로 굴려서 버린다.

export const BOARD = { x: 24, y: 230, w: 672, h: 820 } as const

// 밸런스 상수 — 조절은 전부 여기서
export const BALL_R = 14
export const BALL_SPEED = 520
export const TRIES_PER_LEVEL = 3
export const RUN_LIMIT = 10 // 시도당 제한 시간(초) — 골에 못 가고 계속 돌면 실패
export const MIN_LINE_LEN = 44
export const MAX_LINE_LEN = 250
const EPS = 0.4 // 반사 직후 같은 선에 다시 붙지 않게 밀어내는 여유
const SUBSTEP = BALL_R / 2 // 이동 분할 폭 — 이보다 잘게 옮겨 선을 뚫고 지나가지 않는다
const SCORE_CAP = 1_000_000

export interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Spawn {
  x: number
  y: number
  dx: number
  dy: number
}

export interface Goal {
  x: number
  y: number
  r: number
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

const BORDERS: Seg[] = [
  { x1: BOARD.x, y1: BOARD.y, x2: BOARD.x + BOARD.w, y2: BOARD.y },
  { x1: BOARD.x + BOARD.w, y1: BOARD.y, x2: BOARD.x + BOARD.w, y2: BOARD.y + BOARD.h },
  { x1: BOARD.x + BOARD.w, y1: BOARD.y + BOARD.h, x2: BOARD.x, y2: BOARD.y + BOARD.h },
  { x1: BOARD.x, y1: BOARD.y + BOARD.h, x2: BOARD.x, y2: BOARD.y },
]

function closestOnSeg(s: Seg, px: number, py: number): { x: number; y: number } {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / len2))
  return { x: s.x1 + t * dx, y: s.y1 + t * dy }
}

export function segDist(s: Seg, px: number, py: number): number {
  const c = closestOnSeg(s, px, py)
  return Math.hypot(px - c.x, py - c.y)
}

export interface StepEvents {
  bounces: Array<{ x: number; y: number; seg: Seg }>
  goalHit: boolean
}

// dt만큼 이동하며 반사시킨다. 잘게 나눠 옮기고, 걸음마다 겹친 선에서 밀어낸 뒤
// 다가가는 중일 때만 속도를 반사한다 — 밀어내기와 방향 확인이 재충돌을 막는다.
export function advance(ball: Ball, segs: Seg[], dt: number, goal: Goal | null): StepEvents {
  const events: StepEvents = { bounces: [], goalHit: false }
  const dist = Math.hypot(ball.vx, ball.vy) * dt
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    ball.x += ball.vx * h
    ball.y += ball.vy * h
    for (const s of segs) {
      const c = closestOnSeg(s, ball.x, ball.y)
      let nx = ball.x - c.x
      let ny = ball.y - c.y
      const d = Math.hypot(nx, ny)
      if (d >= BALL_R) continue
      if (d < 1e-6) {
        // 정확히 선 위 — 법선을 속도 반대쪽으로 잡아 반사가 일어나게 한다
        const sl = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1
        nx = -(s.y2 - s.y1) / sl
        ny = (s.x2 - s.x1) / sl
        if (nx * ball.vx + ny * ball.vy > 0) {
          nx = -nx
          ny = -ny
        }
      } else {
        nx /= d
        ny /= d
      }
      ball.x = c.x + nx * (BALL_R + EPS)
      ball.y = c.y + ny * (BALL_R + EPS)
      const dot = ball.vx * nx + ball.vy * ny
      if (dot < 0) {
        ball.vx -= 2 * dot * nx
        ball.vy -= 2 * dot * ny
        if (events.bounces.length < 4) events.bounces.push({ x: c.x, y: c.y, seg: s })
      }
    }
    if (goal && Math.hypot(ball.x - goal.x, ball.y - goal.y) < goal.r) {
      events.goalHit = true
      return events
    }
  }
  return events
}

// ─── 판 생성 ───

export interface LevelDef {
  walls: Seg[]
  spawn: Spawn
  goal: Goal
  maxLines: number
  solution: Seg[] // 역산에 쓴 가상 선 — 이 배치가 곧 정답이라는 증거 (시뮬레이션 검증에도 쓴다)
}

function paramsFor(level: number) {
  return {
    wallCount: level <= 2 ? 0 : Math.min(6, 1 + Math.floor((level - 3) / 2)),
    maxLines: level <= 3 ? 1 : level <= 8 ? 2 : 3,
    goalR: Math.max(36, 64 - (level - 1) * 2),
    // 목표를 채택하기 전까지 요구하는 반사 횟수(경계·벽·가상 선 합산) — 경로 길이를 조인다
    minBounces: Math.min(6, 1 + Math.floor(level / 3)),
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function randomSeg(cx: number, cy: number, len: number, angle: number): Seg {
  const dx = (Math.cos(angle) * len) / 2
  const dy = (Math.sin(angle) * len) / 2
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy }
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function segsCross(a: Seg, b: Seg): boolean {
  const d1 = orient(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1)
  const d2 = orient(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)
  const d3 = orient(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1)
  const d4 = orient(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)
  return d1 * d2 < 0 && d3 * d4 < 0
}

interface Sample {
  x: number
  y: number
  t: number
  bounces: number
  virtualHits: number
}

// 생성용 시뮬레이션 — 프레임과 무관하게 고정 간격으로 굴린다
function simulate(spawn: Spawn, walls: Seg[], virtual: Seg[], seconds: number): Sample[] {
  const segs = [...BORDERS, ...walls, ...virtual]
  const ball: Ball = {
    x: spawn.x,
    y: spawn.y,
    vx: spawn.dx * BALL_SPEED,
    vy: spawn.dy * BALL_SPEED,
  }
  const samples: Sample[] = []
  let bounces = 0
  let virtualHits = 0
  const dt = 1 / 120
  const steps = Math.floor(seconds / dt)
  for (let i = 0; i < steps; i++) {
    const ev = advance(ball, segs, dt, null)
    for (const b of ev.bounces) {
      bounces += 1
      if (virtual.includes(b.seg)) virtualHits += 1
    }
    samples.push({ x: ball.x, y: ball.y, t: (i + 1) * dt, bounces, virtualHits })
  }
  return samples
}

function naturalHitsGoal(spawn: Spawn, walls: Seg[], goal: Goal): boolean {
  const segs = [...BORDERS, ...walls]
  const ball: Ball = {
    x: spawn.x,
    y: spawn.y,
    vx: spawn.dx * BALL_SPEED,
    vy: spawn.dy * BALL_SPEED,
  }
  const dt = 1 / 120
  const steps = Math.floor(RUN_LIMIT / dt)
  for (let i = 0; i < steps; i++) {
    if (advance(ball, segs, dt, goal).goalHit) return true
  }
  return false
}

export function buildLevel(level: number): LevelDef {
  const p = paramsFor(level)
  for (let attempt = 0; attempt < 80; attempt++) {
    // 1) 고정 벽 — 겹치거나 뭉치면 그 벽만 다시 뽑고, 자리가 안 나면 건너뛴다.
    //    (벽 수가 많은 레벨에서 한 벽 때문에 판 전체를 버리면 폴백이 급증한다)
    const walls: Seg[] = []
    for (let i = 0; i < p.wallCount; i++) {
      for (let retry = 0; retry < 12; retry++) {
        const seg = randomSeg(
          rand(BOARD.x + 100, BOARD.x + BOARD.w - 100),
          rand(BOARD.y + 100, BOARD.y + BOARD.h - 100),
          rand(110, 240),
          rand(0, Math.PI),
        )
        const mx = (seg.x1 + seg.x2) / 2
        const my = (seg.y1 + seg.y2) / 2
        if (
          walls.some(
            (w) =>
              segsCross(w, seg) || Math.hypot((w.x1 + w.x2) / 2 - mx, (w.y1 + w.y2) / 2 - my) < 120,
          )
        )
          continue
        walls.push(seg)
        break
      }
    }

    // 2) 출발 위치·방향
    const a = rand(0, Math.PI * 2)
    const spawn: Spawn = {
      x: rand(BOARD.x + 70, BOARD.x + BOARD.w - 70),
      y: rand(BOARD.y + 70, BOARD.y + BOARD.h - 70),
      dx: Math.cos(a),
      dy: Math.sin(a),
    }
    if (walls.some((w) => segDist(w, spawn.x, spawn.y) < BALL_R + 40)) continue

    // 3) 가상 플레이어 선 = 이 판의 정답 배치
    const virtual: Seg[] = []
    for (let i = 0; i < p.maxLines; i++) {
      virtual.push(
        randomSeg(
          rand(BOARD.x + 50, BOARD.x + BOARD.w - 50),
          rand(BOARD.y + 50, BOARD.y + BOARD.h - 50),
          rand(MIN_LINE_LEN + 40, MAX_LINE_LEN),
          rand(0, Math.PI),
        ),
      )
    }
    if (virtual.some((v) => segDist(v, spawn.x, spawn.y) < BALL_R + 24)) continue

    // 4) 굴려 보고 조건에 맞는 경로 위 지점을 목표로 삼는다
    const samples = simulate(spawn, walls, virtual, RUN_LIMIT * 0.65)
    const candidates = samples.filter(
      (s) =>
        s.virtualHits >= 1 &&
        s.bounces >= p.minBounces &&
        s.t >= 0.8 &&
        Math.hypot(s.x - spawn.x, s.y - spawn.y) > 200 &&
        s.x > BOARD.x + p.goalR + 10 &&
        s.x < BOARD.x + BOARD.w - p.goalR - 10 &&
        s.y > BOARD.y + p.goalR + 10 &&
        s.y < BOARD.y + BOARD.h - p.goalR - 10 &&
        walls.every((w) => segDist(w, s.x, s.y) > p.goalR + 14),
    )
    if (candidates.length === 0) continue
    // 경로 뒤쪽에서 골라 반사 몇 번을 지나온 자리가 되게 한다
    const pick =
      candidates[Math.min(candidates.length - 1, Math.floor(rand(candidates.length * 0.4, candidates.length)))]
    const goal: Goal = { x: pick.x, y: pick.y, r: p.goalR }

    // 5) 선을 안 그어도 들어가는 판이면 버린다
    if (naturalHitsGoal(spawn, walls, goal)) continue

    return { walls, spawn, goal, maxLines: p.maxLines, solution: virtual }
  }

  // 80번 다 실패하면 손으로 정한 안전판 — 가로로만 오가는 공이라 45도 선 하나로 위를 꺾어야 한다
  const sx = BOARD.x + BOARD.w * 0.62
  const sy = BOARD.y + BOARD.h * 0.58
  return {
    walls: [],
    spawn: { x: BOARD.x + 90, y: sy, dx: 1, dy: 0 },
    goal: { x: sx, y: BOARD.y + 110, r: 56 },
    maxLines: 1,
    solution: [{ x1: sx - 70, y1: sy + 70, x2: sx + 70, y2: sy - 70 }],
  }
}

// ─── 진행 상태 ───

export type Phase = 'placing' | 'running' | 'over'

export interface ReflectState {
  phase: Phase
  level: number
  score: number
  tries: number
  walls: Seg[]
  lines: Seg[]
  maxLines: number
  spawn: Spawn
  ball: Ball
  goal: Goal
  runTime: number
  runPath: Array<{ x: number; y: number }> // 이번 시도의 궤적
  lastPath: Array<{ x: number; y: number }> // 직전 실패 궤적 — 희미하게 남겨 원인 분석을 돕는다
  clearFlash: number
  clearGain: number
  overTimer: number
  playTime: number
}

export function loadLevel(state: ReflectState) {
  const def = buildLevel(state.level)
  state.walls = def.walls
  state.spawn = def.spawn
  state.goal = def.goal
  state.maxLines = def.maxLines
  state.lines = []
  state.runPath = []
  state.lastPath = []
  state.tries = TRIES_PER_LEVEL
  state.ball = { x: def.spawn.x, y: def.spawn.y, vx: 0, vy: 0 }
  state.runTime = 0
  state.phase = 'placing'
}

export function createState(): ReflectState {
  const state: ReflectState = {
    phase: 'placing',
    level: 1,
    score: 0,
    tries: TRIES_PER_LEVEL,
    walls: [],
    lines: [],
    maxLines: 1,
    spawn: { x: 0, y: 0, dx: 1, dy: 0 },
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    goal: { x: 0, y: 0, r: 40 },
    runTime: 0,
    runPath: [],
    lastPath: [],
    clearFlash: 0,
    clearGain: 0,
    overTimer: 0,
    playTime: 0,
  }
  loadLevel(state)
  return state
}

export interface TickEvents {
  bounces: Array<{ x: number; y: number }>
  cleared: boolean
  failed: boolean
}

export function update(state: ReflectState, dt: number): TickEvents {
  const events: TickEvents = { bounces: [], cleared: false, failed: false }
  state.clearFlash = Math.max(0, state.clearFlash - dt)
  if (state.phase !== 'running') return events

  state.runTime += dt
  const segs = [...BORDERS, ...state.walls, ...state.lines]
  const ev = advance(state.ball, segs, dt, state.goal)
  for (const b of ev.bounces) events.bounces.push({ x: b.x, y: b.y })
  state.runPath.push({ x: state.ball.x, y: state.ball.y })
  if (state.runPath.length > 700) state.runPath.shift()

  if (ev.goalHit) {
    state.clearGain = 100 + state.level * 20 + state.tries * 50
    state.score = Math.min(SCORE_CAP, state.score + state.clearGain)
    state.clearFlash = 1.3
    state.level += 1
    loadLevel(state)
    events.cleared = true
    return events
  }
  if (state.runTime >= RUN_LIMIT) {
    failRun(state)
    events.failed = true
  }
  return events
}

export function launch(state: ReflectState): boolean {
  if (state.phase !== 'placing' || state.tries <= 0) return false
  state.ball = {
    x: state.spawn.x,
    y: state.spawn.y,
    vx: state.spawn.dx * BALL_SPEED,
    vy: state.spawn.dy * BALL_SPEED,
  }
  state.runTime = 0
  state.runPath = []
  state.phase = 'running'
  return true
}

function failRun(state: ReflectState) {
  state.tries -= 1
  state.lastPath = state.runPath
  state.runPath = []
  state.ball = { x: state.spawn.x, y: state.spawn.y, vx: 0, vy: 0 }
  if (state.tries <= 0) {
    state.phase = 'over'
    state.overTimer = 0.8
  } else {
    state.phase = 'placing'
  }
}

// 발사 중 '다시 놓기' — 기다릴 필요 없이 접는다. 시간 초과 실패와 똑같이 시도를 쓴다
export function abortRun(state: ReflectState): boolean {
  if (state.phase !== 'running') return false
  failRun(state)
  return true
}

// 끝점 사이 길이를 상한까지만 허용 — 미리보기와 확정이 같은 규칙을 쓴다
export function capLine(x1: number, y1: number, x2: number, y2: number): Seg {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len <= MAX_LINE_LEN) return { x1, y1, x2, y2 }
  const k = MAX_LINE_LEN / len
  return { x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k }
}

// 그리기 확정. 예산이 차 있으면 가장 오래된 선과 바꾼다 — 다시 긋는 흐름이 끊기지 않게
export function commitLine(state: ReflectState, seg: Seg): 'ok' | 'short' | 'blocked' {
  if (Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) < MIN_LINE_LEN) return 'short'
  // 공 자리를 덮는 선은 발사 순간부터 겹쳐 튕김이 이상해지므로 거절한다
  if (segDist(seg, state.spawn.x, state.spawn.y) < BALL_R + 16) return 'blocked'
  if (state.lines.length >= state.maxLines) state.lines.shift()
  state.lines.push(seg)
  return 'ok'
}

export function removeLineAt(state: ReflectState, x: number, y: number): boolean {
  const i = state.lines.findIndex((l) => segDist(l, x, y) < 30)
  if (i < 0) return false
  state.lines.splice(i, 1)
  return true
}

// 광고 보상: 시도를 받고 같은 판을 이어서 푼다
export function addTries(state: ReflectState, count: number) {
  state.tries += count
  state.phase = 'placing'
}
