// 대나무 타기 — 탭할 때마다 한 마디씩 오른다. 가지가 있는 쪽으로 오르면 부딪혀 끝.
// 시간 막대는 쉬는 동안 계속 줄어들어서 '천천히 안전하게'라는 선택지를 원천 차단한다.

export type Side = -1 | 1 // -1 = 왼쪽

export interface BambooState {
  phase: 'playing' | 'over'
  score: number
  height: number
  side: Side
  branches: number[] // 마디별 가지: 0 없음, -1 왼쪽, 1 오른쪽
  timeBar: number
  scroll: number // 카메라가 따라오는 높이 (보간용)
  hitFlash: number
  deathBy: 'branch' | 'time' | null
  overTimer: number
  playTime: number
}

export const SEG_H = 110
export const BAR_MAX = 5
const BAR_GAIN = 0.34 // 한 마디 오를 때 채워지는 시간
const SEGMENT_POINTS = 10

// 시간 감소만으로 난이도를 올린다 (가지는 조금씩 촘촘해진다)
const drainRate = (height: number) => 1 + Math.min(1.6, height * 0.012)
const branchChance = (height: number) => Math.min(0.72, 0.34 + height * 0.004)

function ensureBranches(state: BambooState, upto: number) {
  while (state.branches.length <= upto) {
    const i = state.branches.length
    // 출발 구간은 비워 둔다
    const branch = i < 2 || Math.random() > branchChance(i) ? 0 : Math.random() < 0.5 ? -1 : 1
    state.branches.push(branch)
  }
}

export function createState(): BambooState {
  const state: BambooState = {
    phase: 'playing',
    score: 0,
    height: 0,
    side: -1,
    branches: [],
    timeBar: BAR_MAX,
    scroll: 0,
    hitFlash: 0,
    deathBy: null,
    overTimer: 0,
    playTime: 0,
  }
  ensureBranches(state, 14)
  return state
}

export function branchAt(state: BambooState, index: number): number {
  return state.branches[index] ?? 0
}

export function update(state: BambooState, dt: number) {
  state.hitFlash = Math.max(0, state.hitFlash - dt)
  state.scroll += (state.height - state.scroll) * Math.min(1, dt * 14)
  if (state.phase !== 'playing') return

  state.timeBar -= drainRate(state.height) * dt
  if (state.timeBar <= 0) {
    state.timeBar = 0
    state.phase = 'over'
    state.deathBy = 'time'
    state.overTimer = 0.8
  }
}

export type ClimbResult = 'up' | 'hit'

export function climb(state: BambooState, side: Side): ClimbResult | null {
  if (state.phase !== 'playing') return null
  const next = state.height + 1
  ensureBranches(state, next + 14)
  state.side = side
  if (branchAt(state, next) === side) {
    state.hitFlash = 0.5
    state.phase = 'over'
    state.deathBy = 'branch'
    state.overTimer = 0.8
    return 'hit'
  }
  state.height = next
  state.score = Math.min(1_000_000, state.score + SEGMENT_POINTS)
  state.timeBar = Math.min(BAR_MAX, state.timeBar + BAR_GAIN)
  return 'up'
}

// 광고 보상: 부딪힌 마디 바로 아래에서 시간 막대를 채워 재개
export function reviveBelow(state: BambooState) {
  // 부딪혔을 때 높이는 오르지 않으므로 지금 자리가 곧 '부딪힌 마디 바로 아래'다.
  // 다만 실패한 탭 방향이 남아 있어서, 그쪽에 가지가 있으면 반대쪽으로 옮겨 준다.
  if (branchAt(state, state.height) === state.side) state.side = state.side === -1 ? 1 : -1
  state.timeBar = BAR_MAX
  state.hitFlash = 0
  state.deathBy = null
  state.phase = 'playing'
}
