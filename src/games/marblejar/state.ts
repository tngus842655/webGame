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
// 자리 수가 곧 난이도 다이얼이다. 자리를 쓰는 사람과 안 쓰는 사람의 점수 차가
// 0칸 0% · 1칸 +23% · 2칸 +59% · 3칸 +110%로 벌어진다(2만 판) — 한 칸으로는
// 만회할 여지가 모자라고, 세 칸이면 한 판이 179알(약 3.6분)이라 캐주얼로는 길다.
export const HOLD_SLOTS = 2
// 판마다 한 번, 통 하나를 통째로 비운다. '언제' 쓰느냐로 2만 판 평균이 39% 갈린다 —
// 섞인 통이 꽉 찼을 때 비우면 4195점으로 가장 좋고, 죽기 직전 보험으로 아끼면
// 3107점이라 아예 안 쓰는 것(3026점)과 거의 다르지 않다. 늦게 쓰면 칸 넷을 되찾을
// 뿐이지만 살려 낸 통은 남은 판 내내 계속 비워져 값이 복리로 붙기 때문이다.
export const WIPES = 1
const MARBLE_POINTS = 5
const CLEAR_POINTS = 120

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
  wipes: number // 남은 통 비우기 횟수
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

// 늘어난 색은 다음 가방부터 나온다. 그래서 색 수도 가방이 새로 열릴 때 반영한다 —
// 통을 비운 순간에 올려 버리면 아직 한 알도 안 나온 색이 '0개'로 떠서
// 다 쓴 색과 구별되지 않는다. 덕분에 '이번 가방은 몇 색'이 중간에 흐트러지지 않는다.
function draw(state: MarbleState): number {
  if (!state.bag.length) {
    state.colors = colorsFor(state.clears)
    state.bag = makeBag(state.colors)
  }
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
    wipes: WIPES,
    overTimer: 0,
    playTime: 0,
  }
  state.marble = draw(state)
  state.next = draw(state)
  return state
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
  if (jar.length >= CAP) return 'rejected'

  jar.push(state.marble)
  state.placed += 1
  state.score = Math.min(1_000_000, state.score + MARBLE_POINTS)

  let cleared = false
  if (jar.length === CAP && !isMixed(jar)) {
    state.jars[index] = []
    state.clears += 1
    state.score = Math.min(1_000_000, state.score + CLEAR_POINTS)
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

// 통 비우기 — 비운 구슬은 이미 받은 점수를 그대로 두고 사라진다.
// 빈 통에는 쓸 수 없다(되찾을 칸이 없어 횟수만 버린다).
export function wipeJar(state: MarbleState, index: number): boolean {
  if (state.phase !== 'playing' || state.wipes <= 0) return false
  if (!state.jars[index].length) return false
  state.jars[index] = []
  state.wipes -= 1
  return true
}

// 광고 보상: 통을 전부 비우고 이어간다.
// 끝난 시점에는 가득 찬 통이 곧 섞인 통이고(순색은 차는 순간 비워지므로) 색도 이미
// 최대라, 몇 개만 비워 줘도 넣을 곳이 금세 다시 막힌다 — 두 개만 비웠을 때 실측
// +42점으로 한 판의 2%였다. 색 수와 가방은 그대로 이어받으므로 늦게 쓸수록 값이 준다.
export function reviveForAd(state: MarbleState) {
  state.jars = Array.from({ length: JARS }, () => [])
  state.phase = 'playing'
}
