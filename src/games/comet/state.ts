// 별똥별 잇기 — 아래에서 포물선으로 솟는 별똥별을 한 획으로 이어 터뜨린다.
// 한 획에 몇 개를 이었느냐로 점수가 크게 뛰지만, 기다리다 놓치면 세 개째에 끝난다.
// 각도가 완전히 무작위면 여러 개를 잇는 판이 아예 안 나와 운으로 읽히므로,
// 나란히 솟는 무리(volley)와 한 점에서 퍼지는 무리(fan)를 의도적으로 섞는다.

export interface Point {
  x: number
  y: number
}

export interface Comet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  trail: Point[]
}

export interface Burst {
  x: number
  y: number
  age: number
}

export interface Pop {
  x: number
  y: number
  text: string
  age: number
}

export interface Stroke {
  points: Point[]
  length: number
  cuts: number
  active: boolean
  age: number
}

export interface CometState {
  phase: 'playing' | 'over'
  score: number
  misses: number
  bestChain: number
  comets: Comet[]
  bursts: Burst[]
  pops: Pop[]
  spawnTimer: number
  spawned: number
  stroke: Stroke | null
  overTimer: number
  playTime: number
}

export const MAX_MISS = 3
const GRAVITY = 620
const COMET_R = 26
const CUT_SLACK = 10
// 한 획의 길이 상한 — 손을 안 떼고 화면 전체를 훑어 배수를 부풀리는 길을 막는다
const MAX_STROKE_LEN = 700
const LAUNCH_Y = 1300
const X_MIN = 90
const X_MAX = 630

const spawnInterval = (spawned: number) => Math.max(1.1, 2.6 - spawned * 0.02)
// 초기 속도가 곧 포물선 높이다. 1,135를 넘기면 꼭대기가 HUD 위로 올라가 손댈 수 없는 구간이 생긴다.
const launchSpeed = (spawned: number) => Math.min(1135, 950 + spawned * 2.5)
// 뭉쳐 오는 비율은 점점 늘어난다 (초반엔 하나씩 나와 조작을 익히게)
const volleyChance = (spawned: number) => Math.min(0.5, 0.16 + spawned * 0.006)

// 3.2초쯤 떠 있는 동안 좌우로 새어 나가면 손도 못 대고 놓친 것이 되므로 안으로 향하게 한다
function launch(state: CometState, x: number, vx: number, vy: number) {
  const flight = (2 * Math.abs(vy)) / GRAVITY
  const landing = x + vx * flight
  const inward = landing < 40 || landing > 680 ? -vx : vx
  state.comets.push({ x, y: LAUNCH_Y, vx: inward, vy, r: COMET_R, trail: [] })
}

function spawnGroup(state: CometState) {
  const speed = launchSpeed(state.spawned)
  const roll = Math.random()
  if (roll < volleyChance(state.spawned)) {
    // 나란한 포물선 — 같은 높이에 늘어서므로 한 번 훑으면 전부 이어진다
    const k = 2 + Math.floor(Math.random() * 3)
    const gap = 78 + Math.random() * 18
    const baseX = X_MIN + Math.random() * Math.max(0, X_MAX - X_MIN - (k - 1) * gap)
    const vx = (Math.random() - 0.5) * 70
    const vy = -speed * 0.95
    for (let i = 0; i < k; i++) launch(state, baseX + i * gap, vx, vy)
  } else if (roll < volleyChance(state.spawned) + 0.22) {
    // 한 점에서 퍼지는 부채
    const k = 2 + Math.floor(Math.random() * 2)
    const x = 200 + Math.random() * 320
    for (let i = 0; i < k; i++) {
      launch(state, x, -110 + (i * 220) / Math.max(1, k - 1), -speed * (0.9 + Math.random() * 0.1))
    }
  } else {
    const x = X_MIN + Math.random() * (X_MAX - X_MIN)
    launch(state, x, (360 - x) * 0.18 + (Math.random() - 0.5) * 80, -speed * (0.9 + Math.random() * 0.12))
  }
  state.spawned += 1
}

export function createState(): CometState {
  return {
    phase: 'playing',
    score: 0,
    misses: 0,
    bestChain: 0,
    comets: [],
    bursts: [],
    pops: [],
    spawnTimer: 0.6,
    spawned: 0,
    stroke: null,
    overTimer: 0,
    playTime: 0,
  }
}

export interface TickEvents {
  missed: boolean
}

export function update(state: CometState, dt: number): TickEvents {
  const events: TickEvents = { missed: false }

  for (let i = state.bursts.length - 1; i >= 0; i--) {
    state.bursts[i].age += dt
    if (state.bursts[i].age > 0.5) state.bursts.splice(i, 1)
  }
  for (let i = state.pops.length - 1; i >= 0; i--) {
    state.pops[i].age += dt
    if (state.pops[i].age > 1.1) state.pops.splice(i, 1)
  }
  if (state.stroke && !state.stroke.active) {
    state.stroke.age += dt
    if (state.stroke.age > 0.35) state.stroke = null
  }
  if (state.phase !== 'playing') return events

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    spawnGroup(state)
    state.spawnTimer = spawnInterval(state.spawned)
  }

  for (let i = state.comets.length - 1; i >= 0; i--) {
    const comet = state.comets[i]
    comet.vy += GRAVITY * dt
    comet.x += comet.vx * dt
    comet.y += comet.vy * dt
    comet.trail.push({ x: comet.x, y: comet.y })
    if (comet.trail.length > 12) comet.trail.shift()
    if (comet.y > LAUNCH_Y + 40) {
      state.comets.splice(i, 1)
      state.misses += 1
      events.missed = true
    }
  }

  if (state.misses >= MAX_MISS) {
    state.phase = 'over'
    state.overTimer = 0.9
  }
  return events
}

function segDistance(a: Point, b: Point, px: number, py: number): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t))
}

export function startStroke(state: CometState, x: number, y: number) {
  if (state.phase !== 'playing') return
  state.stroke = { points: [{ x, y }], length: 0, cuts: 0, active: true, age: 0 }
}

// 방금 그은 선분에 걸린 별똥별을 터뜨린다. 획이 길이 상한에 닿으면 그 자리에서 획을 끝낸다.
export function extendStroke(state: CometState, x: number, y: number): number {
  const stroke = state.stroke
  if (!stroke || !stroke.active || state.phase !== 'playing') return 0
  const last = stroke.points[stroke.points.length - 1]
  const step = Math.hypot(x - last.x, y - last.y)
  if (step < 8) return 0

  const next = { x, y }
  stroke.points.push(next)
  stroke.length += step

  let cut = 0
  for (let i = state.comets.length - 1; i >= 0; i--) {
    const comet = state.comets[i]
    if (segDistance(last, next, comet.x, comet.y) > comet.r + CUT_SLACK) continue
    state.comets.splice(i, 1)
    state.bursts.push({ x: comet.x, y: comet.y, age: 0 })
    stroke.cuts += 1
    cut += 1
  }
  if (stroke.length >= MAX_STROKE_LEN) endStroke(state)
  return cut
}

// 계단식 배수 — 제곱으로 주면 분당 점수가 순식간에 튀어 오른다
const CHAIN_MULTIPLIER = [0, 1, 1.5, 2, 2.5, 3]
const chainMultiplier = (n: number) => CHAIN_MULTIPLIER[Math.min(n, 5)]

export function endStroke(state: CometState): number {
  const stroke = state.stroke
  if (!stroke || !stroke.active) return 0
  stroke.active = false
  const n = stroke.cuts
  if (n === 0) return 0
  const gain = Math.round(20 * n * chainMultiplier(n))
  state.score = Math.min(1_000_000, state.score + gain)
  state.bestChain = Math.max(state.bestChain, n)
  const at = stroke.points[stroke.points.length - 1]
  state.pops.push({ x: at.x, y: at.y, text: n >= 2 ? `+${gain} ×${n}` : `+${gain}`, age: 0 })
  return n
}

// 광고 보상: 놓친 개수를 0으로. 바닥에 거의 닿은 별똥별은 치워 준다 —
// 재개하자마자 그것들 때문에 또 놓치면 광고를 본 값이 없다.
export function resetMisses(state: CometState) {
  state.misses = 0
  state.comets = state.comets.filter((comet) => comet.y < 1100)
  state.phase = 'playing'
}
