// 펭귄 미끄럼 — 쓸면 벽이나 바위에 부딪힐 때까지 한 번에 미끄러진다.
// 중간에 멈출 수 없으니 '어디에 부딪혀 멈출까'를 벽으로 역산해야 한다. 완전 턴제라 손을 떼고 고민해도 된다.
//
// 판은 역산으로 만든다: 바위를 흩은 뒤 무작위 미끄럼을 몇 번 시뮬레이션해서
// 그 '멈춘 칸'에만 별을 놓는다. 그러면 그 경로를 그대로 따라가면 반드시 풀리므로
// 풀 수 없는 판이 나오지 않는다.

export const COLS = 8
export const ROWS = 10
export const CELL = 84
export const X0 = 24
export const Y0 = 250

export type Dir = 'up' | 'down' | 'left' | 'right'
const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}
const DIR_LIST: Dir[] = ['up', 'down', 'left', 'right']

const STAR_POINTS = 50
// 판마다 '최소 수 + 이만큼'을 준다. 남은 횟수를 다음 판으로 넘기면 잘하는 사람은
// 여유를 무한히 쌓아 판이 영원히 안 끝나므로 판마다 다시 채운다.
const MOVE_SLACK = 4
// 탐색을 벌하지 않도록 판마다 공짜 되돌리기를 넉넉히 준다 (다 쓰면 광고 되돌리기)
const FREE_UNDO = 3

export interface Slide {
  fromX: number
  fromY: number
  toX: number
  toY: number
  t: number
  dur: number
  cells: number[] // 지나가는 칸 (별을 지나가며 줍는다)
  taken: number
}

export interface Snapshot {
  px: number
  py: number
  stars: boolean[]
  moves: number
}

export interface IceState {
  phase: 'playing' | 'sliding' | 'over'
  score: number
  level: number
  moves: number
  rocks: boolean[]
  stars: boolean[]
  starsLeft: number
  px: number
  py: number
  facing: Dir
  slide: Slide | null
  history: Snapshot[]
  freeUndo: number
  clearFlash: number
  clearGain: number
  overTimer: number
  playTime: number
}

const idx = (x: number, y: number) => y * COLS + x

// 그 방향으로 끝까지 미끄러진 자리
function slideTarget(rocks: boolean[], x: number, y: number, dir: Dir): [number, number] {
  const [dx, dy] = DIRS[dir]
  let cx = x
  let cy = y
  for (;;) {
    const nx = cx + dx
    const ny = cy + dy
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) break
    if (rocks[idx(nx, ny)]) break
    cx = nx
    cy = ny
  }
  return [cx, cy]
}

function shuffled<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

interface Level {
  rocks: boolean[]
  stars: boolean[]
  px: number
  py: number
  best: number // 최소 몇 수에 풀리는지 (지급 횟수의 기준)
  starCount: number
}

// 최소 이동 수 — 상태는 (위치, 주운 별 비트마스크). 별 9개·80칸이라 4만 상태 남짓이다.
function minMoves(rocks: boolean[], starCells: number[], px: number, py: number): number {
  const full = (1 << starCells.length) - 1
  const bit = new Map<number, number>()
  starCells.forEach((cell, i) => bit.set(cell, 1 << i))
  const key = (x: number, y: number, mask: number) => idx(x, y) * (full + 1) + mask

  let frontier: Array<[number, number, number]> = [[px, py, 0]]
  const seen = new Set([key(px, py, 0)])
  for (let depth = 0; depth <= 40; depth++) {
    const next: Array<[number, number, number]> = []
    for (const [x, y, mask] of frontier) {
      if (mask === full) return depth
      for (const dir of DIR_LIST) {
        const [dx, dy] = DIRS[dir]
        const [tx, ty] = slideTarget(rocks, x, y, dir)
        if (tx === x && ty === y) continue
        let nextMask = mask
        let cx = x
        let cy = y
        while (cx !== tx || cy !== ty) {
          cx += dx
          cy += dy
          nextMask |= bit.get(idx(cx, cy)) ?? 0
        }
        const k = key(tx, ty, nextMask)
        if (seen.has(k)) continue
        seen.add(k)
        next.push([tx, ty, nextMask])
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return Infinity
}

function buildLevel(level: number): Level {
  const rockCount = Math.min(22, 7 + level)
  const starCount = Math.min(9, 3 + Math.floor(level / 3))
  const walk = starCount + 2 + Math.min(8, Math.floor(level / 2))

  for (let attempt = 0; attempt < 80; attempt++) {
    const rocks = Array<boolean>(COLS * ROWS).fill(false)
    for (let i = 0; i < rockCount; i++) {
      rocks[Math.floor(Math.random() * COLS * ROWS)] = true
    }
    let px = Math.floor(Math.random() * COLS)
    let py = Math.floor(Math.random() * ROWS)
    if (rocks[idx(px, py)]) continue

    const startIndex = idx(px, py)
    const stops: number[] = []
    let x = px
    let y = py
    for (let step = 0; step < walk; step++) {
      let moved = false
      for (const dir of shuffled(DIR_LIST)) {
        const [nx, ny] = slideTarget(rocks, x, y, dir)
        if (nx === x && ny === y) continue
        x = nx
        y = ny
        stops.push(idx(x, y))
        moved = true
        break
      }
      if (!moved) break
    }

    const unique = [...new Set(stops)].filter((i) => i !== startIndex)
    if (unique.length < starCount) continue
    const stars = Array<boolean>(COLS * ROWS).fill(false)
    const cells = shuffled(unique).slice(0, starCount)
    for (const i of cells) stars[i] = true
    // 만든 경로가 있으니 반드시 풀리지만, 지급 횟수는 '최소 몇 수'를 기준으로 잡는다
    const best = minMoves(rocks, cells, px, py)
    if (!Number.isFinite(best)) continue
    return { rocks, stars, px, py, best, starCount }
  }

  // 여기까지 오면 바위 없이 뻥 뚫린 판을 준다 (80번 시도가 다 실패하는 일은 사실상 없다)
  const rocks = Array<boolean>(COLS * ROWS).fill(false)
  const stars = Array<boolean>(COLS * ROWS).fill(false)
  stars[idx(COLS - 1, 0)] = true
  stars[idx(0, ROWS - 1)] = true
  stars[idx(COLS - 1, ROWS - 1)] = true
  return { rocks, stars, px: 0, py: 0, best: 4, starCount: 3 }
}

function loadLevel(state: IceState) {
  const level = buildLevel(state.level)
  state.rocks = level.rocks
  state.stars = level.stars
  state.starsLeft = level.starCount
  state.px = level.px
  state.py = level.py
  state.facing = 'down'
  state.slide = null
  state.history = []
  state.freeUndo = FREE_UNDO
  state.moves = level.best + MOVE_SLACK
  state.phase = 'playing'
}

export function createState(): IceState {
  const state: IceState = {
    phase: 'playing',
    score: 0,
    level: 1,
    moves: 0,
    rocks: [],
    stars: [],
    starsLeft: 0,
    px: 0,
    py: 0,
    facing: 'down',
    slide: null,
    history: [],
    freeUndo: FREE_UNDO,
    clearFlash: 0,
    clearGain: 0,
    overTimer: 0,
    playTime: 0,
  }
  loadLevel(state)
  return state
}

export interface TickEvents {
  stars: number
  cleared: boolean
  stopped: boolean
}

export function update(state: IceState, dt: number): TickEvents {
  const events: TickEvents = { stars: 0, cleared: false, stopped: false }
  state.clearFlash = Math.max(0, state.clearFlash - dt)

  const slide = state.slide
  if (state.phase !== 'sliding' || !slide) return events

  slide.t = Math.min(1, slide.t + dt / slide.dur)
  // 지나간 칸까지 별을 줍는다 — 멈춘 자리에서만 줍게 하면 계산이 아니라 운이 된다
  const upto = slide.t >= 1 ? slide.cells.length : Math.floor(slide.t * slide.cells.length)
  while (slide.taken < upto) {
    const cell = slide.cells[slide.taken]
    slide.taken += 1
    if (!state.stars[cell]) continue
    state.stars[cell] = false
    state.starsLeft -= 1
    state.score = Math.min(1_000_000, state.score + STAR_POINTS)
    events.stars += 1
  }
  if (slide.t < 1) return events

  state.slide = null
  state.phase = 'playing'
  events.stopped = true
  if (state.starsLeft === 0) {
    state.clearGain = 100 + state.level * 10
    state.score = Math.min(1_000_000, state.score + state.clearGain)
    state.clearFlash = 1.3
    state.level += 1
    loadLevel(state)
    events.cleared = true
  } else if (state.moves <= 0) {
    state.phase = 'over'
    state.overTimer = 0.8
  }
  return events
}

// 쓸기 한 번 = 한 수. 벽에 붙어 있어 못 움직이면 횟수를 쓰지 않는다.
export function slide(state: IceState, dir: Dir): boolean {
  if (state.phase !== 'playing' || state.moves <= 0) return false
  const [nx, ny] = slideTarget(state.rocks, state.px, state.py, dir)
  state.facing = dir
  if (nx === state.px && ny === state.py) return false

  state.history.push({ px: state.px, py: state.py, stars: [...state.stars], moves: state.moves })
  if (state.history.length > 40) state.history.shift()

  const [dx, dy] = DIRS[dir]
  const cells: number[] = []
  let cx = state.px
  let cy = state.py
  while (cx !== nx || cy !== ny) {
    cx += dx
    cy += dy
    cells.push(idx(cx, cy))
  }

  state.moves -= 1
  state.slide = {
    fromX: state.px,
    fromY: state.py,
    toX: nx,
    toY: ny,
    t: 0,
    dur: Math.max(0.14, cells.length * 0.055),
    cells,
    taken: 0,
  }
  state.px = nx
  state.py = ny
  state.phase = 'sliding'
  return true
}

export function canUndo(state: IceState): boolean {
  return state.phase === 'playing' && state.history.length > 0
}

// 한 수 되돌리기 — 위치·별·남은 횟수를 그대로 되돌린다 (되돌리면 쓴 횟수도 돌아온다)
export function undo(state: IceState): boolean {
  if (!canUndo(state)) return false
  const snap = state.history.pop()
  if (!snap) return false
  state.px = snap.px
  state.py = snap.py
  state.stars = snap.stars
  state.starsLeft = snap.stars.filter(Boolean).length
  state.moves = snap.moves
  return true
}

// 광고 보상: 이동 5회를 받아 그 판을 이어서 푼다
export function addMoves(state: IceState, count: number) {
  state.moves += count
  state.phase = 'playing'
}
