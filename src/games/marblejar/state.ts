// 구슬 정리함 — 구슬이 한 알씩 나오고, 통 다섯 개 중 어디에 넣을지 고른다.
// 통에 정해진 색이 없어서 '어느 통을 어느 색 전용으로 쓸지' 배정하는 것이 판의 뼈대다.
// 구슬은 가방에서 나온다: 색마다 정확히 한 통 분량이 들어 있어, 가방 하나를 온전히
// 처리하면 아무것도 잃지 않는다 — 손해는 운이 아니라 실수에서만 나온다.
// 임시 자리 한 칸이 그 실수를 만회할 여지를 주고, 비운 횟수가 쌓여 색이 통 수를
// 넘어서면 결국 무너진다. 끝은 정해져 있되 언제 오느냐는 실력이 정한다.

export const JARS = 5
export const CAP = 4
export const COLORS = ['#EF5350', '#42A5F5', '#FFCA28', '#66BB6A', '#AB47BC', '#26C6DA', '#FF7043']
const START_COLORS = 4 // 통보다 하나 적게 시작한다 — 초반은 실수만 안 하면 버틴다
const MAX_COLORS = 7
// 자리 수가 곧 난이도 다이얼이다. 시뮬레이션에서 실력이 벌어들이는 몫이
// 0칸 -17% · 1칸 -3% · 2칸 +23%로 갈렸다 — 한 칸으로는 만회할 여지가 모자란다
export const HOLD_SLOTS = 2
const MARBLE_POINTS = 5
const CLEAR_POINTS = 120
// 통 하나만 비워 주면 넣을 곳이 한 통뿐이라 네 알 만에 제자리로 돌아온다
const AD_EMPTY_JARS = 2

export interface MarbleState {
  phase: 'playing' | 'over'
  score: number
  jars: number[][] // 아래부터 쌓인 색 인덱스
  marble: number // 손에 든 구슬
  next: number // 다음에 올 구슬
  hold: (number | null)[] // 임시 자리
  bag: number[] // 아직 안 나온 구슬 (뒤에서 꺼낸다)
  colors: number
  clears: number
  placed: number
  clearFlash: { jar: number; t: number } | null
  rejectFlash: { jar: number; t: number } | null
  overTimer: number
  playTime: number
}

// 비운 횟수가 쌓이면 색을 하나 늘린다 — 통 수를 넘어서는 순간부터 붕괴가 시작된다
const colorsFor = (clears: number) => Math.min(MAX_COLORS, START_COLORS + Math.floor(clears / 3))

// 섞인 통은 다시 한 색이 될 수 없으므로 그 순간부터 '버리는 통'이다
export const isMixed = (jar: number[]) => jar.length > 1 && jar.some((c) => c !== jar[0])

// 색마다 통 하나를 정확히 채울 만큼 담는다. 매번 무작위로 뽑으면 '빨강만 연달아 여섯 번'
// 같은 억울한 판이 나오는데, 가방은 그 분산을 없애면서 '무엇이 아직 안 나왔나'를 세는
// 판단은 실력으로 남긴다.
function makeBag(colors: number): number[] {
  const bag: number[] = []
  for (let c = 0; c < colors; c++) for (let i = 0; i < CAP; i++) bag.push(c)
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

// 가방이 비면 그때의 색 수로 새로 채운다 — 색이 느는 시점이 가방 경계와 맞아떨어져
// '이번 가방은 몇 색인지'가 중간에 흐트러지지 않는다
function draw(state: MarbleState): number {
  if (!state.bag.length) state.bag = makeBag(state.colors)
  return state.bag.pop() as number
}

export function createState(): MarbleState {
  const state: MarbleState = {
    phase: 'playing',
    score: 0,
    jars: Array.from({ length: JARS }, () => []),
    marble: 0,
    next: 0,
    hold: Array.from({ length: HOLD_SLOTS }, () => null),
    bag: makeBag(START_COLORS),
    colors: START_COLORS,
    clears: 0,
    placed: 0,
    clearFlash: null,
    rejectFlash: null,
    overTimer: 0,
    playTime: 0,
  }
  state.marble = draw(state)
  state.next = draw(state)
  return state
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

// 이번 가방에 아직 안 나온 색별 개수 — 화면 위에 늘어놓아 다음을 셀 수 있게 한다.
// 숨기면 기억력 시험이 될 뿐이라, 정보는 보여 주고 활용만 실력으로 남긴다.
export function remainingByColor(state: MarbleState): number[] {
  const counts = Array.from({ length: state.colors }, () => 0)
  for (const c of state.bag) counts[c] += 1
  return counts
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

  state.marble = state.next
  state.next = draw(state)
  if (state.jars.every((j) => j.length >= CAP)) {
    state.phase = 'over'
    state.overTimer = 0.8
  }
  return cleared ? 'cleared' : 'placed'
}

// 임시 자리 — 빈 자리에 넣을 때만 새 구슬이 나오고, 찬 자리는 손과 맞바꾸기만 한다.
// 그래서 싫은 색을 자리에 묵혀 두는 것은 자유지만 그만큼 자리 한 칸을 잃는 값을 치른다.
export function useHold(state: MarbleState, slot: number): boolean {
  if (state.phase !== 'playing') return false
  const kept = state.hold[slot]
  state.hold[slot] = state.marble
  if (kept === null) {
    state.marble = state.next
    state.next = draw(state)
  } else {
    state.marble = kept
  }
  return true
}

// 광고 보상: 통 두 개를 비운다. 끝난 시점에는 가득 찬 통이 곧 섞인 통이라
// (순색은 가득 차는 순간 비워지므로) 어느 통을 고르든 값이 같다.
export function emptyJarsForAd(state: MarbleState) {
  for (let i = 0; i < AD_EMPTY_JARS; i++) state.jars[i] = []
  state.phase = 'playing'
}
