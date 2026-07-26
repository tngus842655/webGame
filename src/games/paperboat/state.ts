// 종이배 뱃길 — 들어오는 종이배마다 같은 색 부두까지 손가락으로 항로를 그어 보낸다.
// 조종하는 아바타가 없다. 여러 척을 번갈아 손질하는 것 자체가 실력이고, 배끼리 부딪히면 끝.
// 항로가 없는 배는 뱃머리 방향으로 계속 나아가다 못에 부딪혀 방향을 튼다 — 그래서 놔두면 못이 붐빈다.

export const COLORS = ['#EF5350', '#42A5F5', '#FFCA28', '#66BB6A']

export interface Dock {
  x: number
  y: number
  color: number
  angle: number // 부두가 물을 향하는 방향 (돌출부 그리기용)
  appearAt: number // 이만큼 도착시키면 열린다
}

// 부두는 못 가장자리에 붙는다. 색이 늘어날 때마다 하나씩 열린다.
export const DOCKS: Dock[] = [
  { x: 62, y: 470, color: 0, angle: 0, appearAt: 0 },
  { x: 658, y: 660, color: 1, angle: Math.PI, appearAt: 0 },
  { x: 470, y: 1198, color: 2, angle: -Math.PI / 2, appearAt: 6 },
  { x: 200, y: 1198, color: 3, angle: -Math.PI / 2, appearAt: 16 },
]

export const BOUNDS = { x0: 34, x1: 686, y0: 168, y1: 1246 }
export const GRAB_R = 48 // 움직이는 배를 넉넉히 집을 수 있게
export const DOCK_R = 54
const CRASH_R = 32
const PATH_STEP = 14
const MAX_PATH = 90
const MAX_BOATS = 9
const COMBO_WINDOW = 5

export interface Point {
  x: number
  y: number
}

export interface Boat {
  x: number
  y: number
  heading: number
  speed: number
  color: number
  path: Point[]
}

export interface Pop {
  x: number
  y: number
  text: string
  age: number
}

export interface BoatState {
  phase: 'playing' | 'over'
  score: number
  docked: number
  combo: number
  sinceDock: number
  boats: Boat[]
  spawnTimer: number
  crash: Point | null
  crashed: Boat[] // 광고로 치울 두 척
  dockFlash: number
  pops: Pop[]
  overTimer: number
  playTime: number
}

// 첫 1분은 아주 완만하게 — 배가 느리고 생성 주기도 길다
const spawnInterval = (docked: number) => Math.max(2.6, 6.5 - docked * 0.13)
const boatSpeed = (docked: number) => Math.min(108, 62 + docked * 0.95)

export const activeDocks = (state: BoatState) => DOCKS.filter((d) => state.docked >= d.appearAt)

export function createState(): BoatState {
  return {
    phase: 'playing',
    score: 0,
    docked: 0,
    combo: 0,
    sinceDock: 99,
    boats: [],
    spawnTimer: 1,
    crash: null,
    crashed: [],
    dockFlash: 0,
    pops: [],
    overTimer: 0,
    playTime: 0,
  }
}

function spawn(state: BoatState) {
  const docks = activeDocks(state)
  // 이미 떠 있는 배와 겹치는 자리에 내보내면 손쓸 새 없이 충돌한다
  for (let tries = 0; tries < 14; tries++) {
    const x = 120 + Math.random() * 480
    if (state.boats.some((b) => Math.hypot(b.x - x, b.y - BOUNDS.y0 - 8) < 110)) continue
    state.boats.push({
      x,
      y: BOUNDS.y0 + 8,
      heading: Math.PI / 2 + (Math.random() - 0.5) * 0.7,
      speed: boatSpeed(state.docked),
      color: docks[Math.floor(Math.random() * docks.length)].color,
      path: [],
    })
    return
  }
}

function advance(boat: Boat, dist: number) {
  while (dist > 0 && boat.path.length > 0) {
    const p = boat.path[0]
    const d = Math.hypot(p.x - boat.x, p.y - boat.y)
    if (d < 0.5) {
      boat.path.shift()
      continue
    }
    boat.heading = Math.atan2(p.y - boat.y, p.x - boat.x)
    if (d <= dist) {
      boat.x = p.x
      boat.y = p.y
      dist -= d
      boat.path.shift()
    } else {
      boat.x += ((p.x - boat.x) / d) * dist
      boat.y += ((p.y - boat.y) / d) * dist
      dist = 0
    }
  }
  // 항로가 끝나면 뱃머리 방향으로 계속 나아간다
  if (dist > 0) {
    boat.x += Math.cos(boat.heading) * dist
    boat.y += Math.sin(boat.heading) * dist
  }
}

function bounce(boat: Boat) {
  if (boat.x < BOUNDS.x0) {
    boat.x = BOUNDS.x0
    boat.heading = Math.PI - boat.heading
  } else if (boat.x > BOUNDS.x1) {
    boat.x = BOUNDS.x1
    boat.heading = Math.PI - boat.heading
  }
  if (boat.y < BOUNDS.y0) {
    boat.y = BOUNDS.y0
    boat.heading = -boat.heading
  } else if (boat.y > BOUNDS.y1) {
    boat.y = BOUNDS.y1
    boat.heading = -boat.heading
  }
}

function tryDock(state: BoatState, boat: Boat): number | null {
  for (const dock of activeDocks(state)) {
    if (dock.color !== boat.color) continue
    if (Math.hypot(dock.x - boat.x, dock.y - boat.y) > DOCK_R) continue
    state.docked += 1
    state.combo = state.sinceDock <= COMBO_WINDOW ? state.combo + 1 : 1
    state.sinceDock = 0
    const gain = 30 + 10 * Math.min(state.combo - 1, 8)
    state.score = Math.min(1_000_000, state.score + gain)
    state.pops.push({ x: dock.x, y: dock.y, text: `+${gain}`, age: 0 })
    if (DOCKS.some((d) => d.appearAt === state.docked)) state.dockFlash = 1.4
    return gain
  }
  return null
}

export interface TickEvents {
  docked: number // 이번 프레임에 도착한 배 수
  crashed: boolean
}

export function update(state: BoatState, dt: number): TickEvents {
  const events: TickEvents = { docked: 0, crashed: false }
  state.dockFlash = Math.max(0, state.dockFlash - dt)
  for (let i = state.pops.length - 1; i >= 0; i--) {
    state.pops[i].age += dt
    if (state.pops[i].age > 1) state.pops.splice(i, 1)
  }
  if (state.phase !== 'playing') return events

  state.sinceDock += dt
  if (state.sinceDock > COMBO_WINDOW) state.combo = 0

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    if (state.boats.length < MAX_BOATS) spawn(state)
    state.spawnTimer = spawnInterval(state.docked)
  }

  for (let i = state.boats.length - 1; i >= 0; i--) {
    const boat = state.boats[i]
    advance(boat, boat.speed * dt)
    bounce(boat)
    if (tryDock(state, boat) !== null) {
      state.boats.splice(i, 1)
      events.docked += 1
    }
  }

  for (let i = 0; i < state.boats.length; i++) {
    for (let j = i + 1; j < state.boats.length; j++) {
      const a = state.boats[i]
      const b = state.boats[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) > CRASH_R) continue
      state.phase = 'over'
      state.crash = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      state.crashed = [a, b]
      state.overTimer = 1
      events.crashed = true
      return events
    }
  }
  return events
}

// 배를 집으면 그리던 항로는 버리고 새로 긋는다
export function grabBoat(state: BoatState, x: number, y: number): Boat | null {
  if (state.phase !== 'playing') return null
  let best: Boat | null = null
  let bestDist = GRAB_R
  for (const boat of state.boats) {
    const d = Math.hypot(boat.x - x, boat.y - y)
    if (d <= bestDist) {
      best = boat
      bestDist = d
    }
  }
  if (best) best.path = []
  return best
}

export function extendPath(boat: Boat, x: number, y: number) {
  if (boat.path.length >= MAX_PATH) return
  const px = Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, x))
  const py = Math.min(BOUNDS.y1, Math.max(BOUNDS.y0, y))
  const last = boat.path[boat.path.length - 1] ?? { x: boat.x, y: boat.y }
  if (Math.hypot(px - last.x, py - last.y) < PATH_STEP) return
  boat.path.push({ x: px, y: py })
}

// 광고 보상: 부딪힌 두 척만 치운다. 나머지 배와 콤보는 그대로 남는다.
export function clearCrashPair(state: BoatState) {
  state.boats = state.boats.filter((b) => !state.crashed.includes(b))
  state.crashed = []
  state.crash = null
  state.phase = 'playing'
}
