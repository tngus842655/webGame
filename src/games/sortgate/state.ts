// 분류 반장 — 위쪽 두 상자에 걸린 기준(색/모양/크기)을 보고 떨어지는 도형을 맞는 쪽으로 민다.
// 몇 개마다 기준이 통째로 갈린다. 두 상자에서 '다른 점'이 곧 기준이라 글자 없이 규칙이 전달된다.
// 교체를 기습으로 만들지 않기 위해 도형이 멈춘 사이에 바꾸고, 예고 시간(announce) 동안은 도형을 내보내지 않는다.

export const COLORS = ['#EF5350', '#FFCA28', '#42A5F5']
export const SHAPES = ['circle', 'triangle', 'square'] as const
export type ShapeKind = (typeof SHAPES)[number]
export type Axis = 'color' | 'shape' | 'size'
export type Side = -1 | 1

export const SPAWN_Y = 480
export const BOTTOM_Y = 1110
export const BOX_Y = 286 // 상자 중심
export const BOX_X: Record<'left' | 'right', number> = { left: 186, right: 534 }
export const RADIUS = [34, 54] // 작음 / 큼

export interface Piece {
  kind: ShapeKind
  color: number
  size: number
  y: number
  side: 0 | Side // 0 = 아직 낙하 중
  fly: number // 상자로 날아가는 진행도 0~1
  correct: boolean
}

export interface Criterion {
  axis: Axis
  left: number // 축에 따른 값 (색/모양 인덱스, 크기 0·1)
  right: number
}

export interface SortState {
  phase: 'playing' | 'over'
  score: number
  lives: number
  streak: number
  resolved: number // 처리한 도형 수 (맞든 틀리든)
  nextSwitchAt: number
  crit: Criterion
  piece: Piece | null
  announce: number // 기준 예고 남은 시간
  announceSpan: number
  wrongFlash: number
  hintSide: 0 | Side // 틀렸을 때 정답 상자를 알려준다
  hintTimer: number
  overTimer: number
  playTime: number
}

const fallSpeed = (resolved: number) => Math.min(700, 240 + resolved * 8)
// 교체 주기: 8개에서 시작해 4개까지 조인다 (±2로 흔들어 예측되지 않게)
const switchGap = (resolved: number) => Math.max(4, 8 - Math.floor(resolved / 12)) + Math.floor(Math.random() * 3)

function pickPair(n: number): [number, number] {
  const a = Math.floor(Math.random() * n)
  let b = Math.floor(Math.random() * (n - 1))
  if (b >= a) b += 1
  return [a, b]
}

function newCriterion(prev: Criterion | null): Criterion {
  // 같은 축에서 좌우만 뒤집는 교체 — 가장 얄궂지만 한눈에 보이기 때문에 억울하지 않다
  if (prev && Math.random() < 0.25) return { axis: prev.axis, left: prev.right, right: prev.left }
  const axes: Axis[] = ['color', 'shape', 'size']
  const pool = prev ? axes.filter((a) => a !== prev.axis) : axes
  const axis = pool[Math.floor(Math.random() * pool.length)]
  if (axis === 'size') return Math.random() < 0.5 ? { axis, left: 0, right: 1 } : { axis, left: 1, right: 0 }
  const [left, right] = pickPair(3)
  return { axis, left, right }
}

export function valueOn(piece: Piece, axis: Axis): number {
  if (axis === 'color') return piece.color
  if (axis === 'size') return piece.size
  return SHAPES.indexOf(piece.kind)
}

export function correctSide(state: SortState, piece: Piece): Side {
  return valueOn(piece, state.crit.axis) === state.crit.left ? -1 : 1
}

// 기준 축의 값만 두 상자 중 하나에 맞춘다. 나머지 속성은 무작위 —
// 그 무작위한 부분을 무시할 수 있는지가 이 게임의 실력이다.
function spawn(state: SortState) {
  const { crit } = state
  const target = Math.random() < 0.5 ? crit.left : crit.right
  const piece: Piece = {
    kind: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: Math.floor(Math.random() * COLORS.length),
    size: Math.random() < 0.5 ? 0 : 1,
    y: SPAWN_Y,
    side: 0,
    fly: 0,
    correct: false,
  }
  if (crit.axis === 'color') piece.color = target
  else if (crit.axis === 'size') piece.size = target
  else piece.kind = SHAPES[target]
  state.piece = piece
}

export function createState(): SortState {
  const crit = newCriterion(null)
  const state: SortState = {
    phase: 'playing',
    score: 0,
    lives: 3,
    streak: 0,
    resolved: 0,
    nextSwitchAt: switchGap(0),
    crit,
    piece: null,
    announce: 2,
    announceSpan: 2,
    wrongFlash: 0,
    hintSide: 0,
    hintTimer: 0,
    overTimer: 0,
    playTime: 0,
  }
  return state
}

function applyResult(state: SortState, correct: boolean) {
  state.resolved += 1
  if (correct) {
    state.streak += 1
    state.score = Math.min(1_000_000, state.score + 20 + Math.min(state.streak, 10) * 3)
    return
  }
  state.streak = 0
  state.lives -= 1
  state.wrongFlash = 0.5
  if (state.lives <= 0) {
    state.lives = 0
    state.phase = 'over'
    state.overTimer = 0.9
  }
}

function afterResolve(state: SortState) {
  if (state.phase !== 'playing') return
  if (state.resolved >= state.nextSwitchAt) {
    state.crit = newCriterion(state.crit)
    state.nextSwitchAt = state.resolved + switchGap(state.resolved)
    state.announce = 1.4
    state.announceSpan = 1.4
    return
  }
  spawn(state)
}

export interface TickEvents {
  missed: boolean
}

export function update(state: SortState, dt: number): TickEvents {
  const events: TickEvents = { missed: false }
  state.wrongFlash = Math.max(0, state.wrongFlash - dt)
  state.hintTimer = Math.max(0, state.hintTimer - dt)

  const piece = state.piece
  // 날아가는 중에는 게임오버여도 연출을 끝까지 보여 준다 (허공에 멈춰 있으면 고장으로 보인다)
  if (piece && piece.side !== 0) {
    piece.fly = Math.min(1, piece.fly + dt * 3.4)
    if (piece.fly >= 1) {
      state.piece = null
      afterResolve(state)
    }
    return events
  }
  if (state.phase !== 'playing') return events

  if (piece) {
    piece.y += fallSpeed(state.resolved) * dt
    if (piece.y >= BOTTOM_Y) {
      state.hintSide = correctSide(state, piece)
      state.hintTimer = 0.9
      state.piece = null
      applyResult(state, false)
      events.missed = true
      afterResolve(state)
    }
    return events
  }
  if (state.announce > 0) {
    state.announce = Math.max(0, state.announce - dt)
    if (state.announce === 0) spawn(state)
    return events
  }
  spawn(state)
  return events
}

// 좌우 입력: 정답 여부를 돌려준다 (처리할 도형이 없으면 null)
export function sort(state: SortState, side: Side): boolean | null {
  const piece = state.piece
  if (state.phase !== 'playing' || !piece || piece.side !== 0) return null
  const correct = correctSide(state, piece) === side
  piece.side = side
  piece.fly = 0
  piece.correct = correct
  if (!correct) {
    state.hintSide = correctSide(state, piece)
    state.hintTimer = 0.9
  }
  applyResult(state, correct)
  return correct
}

// 광고 보상: 목숨 하나로 재개. 재개 직전 현재 기준을 3초간 크게 보여 줘야 억울함이 남지 않는다.
export function reviveWithLife(state: SortState) {
  state.lives = 1
  state.piece = null
  state.wrongFlash = 0
  state.hintTimer = 0
  state.phase = 'playing'
  state.announce = 3
  state.announceSpan = 3
}
