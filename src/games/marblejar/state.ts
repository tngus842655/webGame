// 구슬 정리함 — 무작위 색 구슬이 한 알씩 나오고, 통 네 개 중 어디에 넣을지만 고른다.
// 통에 정해진 색이 없어서 '어느 통을 어느 색 전용으로 쓸지' 배정하는 결정 하나가 게임의 전부다.
// 색 종류가 통 수보다 많다는 규칙이 붕괴를 수학적으로 예고한다: 갈 곳 없는 색은 어느 통이든
// 섞어 놓아야 하고, 한 번 섞인 통은 다시 비워지지 않는다.

export const JARS = 4
export const CAP = 4
export const COLORS = ['#EF5350', '#42A5F5', '#FFCA28', '#66BB6A', '#AB47BC', '#26C6DA', '#FF7043']
const START_COLORS = 5 // 4색·4통이면 초반에 결정할 것이 없어 지루하다
const MAX_COLORS = 7
const MARBLE_POINTS = 5
const CLEAR_POINTS = 120

export interface MarbleState {
  phase: 'playing' | 'over'
  score: number
  jars: number[][] // 아래부터 쌓인 색 인덱스
  marble: number
  colors: number
  clears: number
  placed: number
  clearFlash: { jar: number; t: number } | null
  rejectFlash: { jar: number; t: number } | null
  overTimer: number
  playTime: number
}

// 비운 횟수가 쌓이면 색을 하나 늘린다 — 통 수와의 차이가 벌어져 붕괴가 빨라진다
const colorsFor = (clears: number) => Math.min(MAX_COLORS, START_COLORS + Math.floor(clears / 3))

// 섞인 통은 다시 한 색이 될 수 없으므로 그 순간부터 '버리는 통'이다
export const isMixed = (jar: number[]) => jar.length > 1 && jar.some((c) => c !== jar[0])

export function createState(): MarbleState {
  return {
    phase: 'playing',
    score: 0,
    jars: Array.from({ length: JARS }, () => []),
    marble: Math.floor(Math.random() * START_COLORS),
    colors: START_COLORS,
    clears: 0,
    placed: 0,
    clearFlash: null,
    rejectFlash: null,
    overTimer: 0,
    playTime: 0,
  }
}

export function update(state: MarbleState, dt: number) {
  if (state.clearFlash) {
    state.clearFlash.t -= dt
    if (state.clearFlash.t <= 0) state.clearFlash = null
  }
  if (state.rejectFlash) {
    state.rejectFlash.t -= dt
    if (state.rejectFlash.t <= 0) state.rejectFlash = null
  }
}

export type PlaceResult = 'placed' | 'cleared' | 'rejected'

export function place(state: MarbleState, index: number): PlaceResult | null {
  if (state.phase !== 'playing') return null
  const jar = state.jars[index]
  if (jar.length >= CAP) {
    state.rejectFlash = { jar: index, t: 0.3 }
    return 'rejected'
  }

  jar.push(state.marble)
  state.placed += 1
  state.score = Math.min(1_000_000, state.score + MARBLE_POINTS)

  let cleared = false
  if (jar.length === CAP && !isMixed(jar)) {
    state.jars[index] = []
    state.clears += 1
    state.score = Math.min(1_000_000, state.score + CLEAR_POINTS)
    state.clearFlash = { jar: index, t: 0.6 }
    state.colors = colorsFor(state.clears)
    cleared = true
  }

  state.marble = Math.floor(Math.random() * state.colors)
  if (state.jars.every((j) => j.length >= CAP)) {
    state.phase = 'over'
    state.overTimer = 0.8
  }
  return cleared ? 'cleared' : 'placed'
}

// 광고 보상: 통 하나를 비운다. 끝났을 때는 네 통이 다 차 있으므로
// 그중 가장 많이 섞인 통(되살릴 값이 가장 낮은 통)을 비워 준다.
export function emptyFullestJar(state: MarbleState) {
  let target = 0
  let worst = -1
  for (let i = 0; i < JARS; i++) {
    const jar = state.jars[i]
    const distinct = new Set(jar).size
    const rank = jar.length * 10 + distinct
    if (rank > worst) {
      worst = rank
      target = i
    }
  }
  state.jars[target] = []
  state.clearFlash = { jar: target, t: 0.6 }
  state.phase = 'playing'
}
