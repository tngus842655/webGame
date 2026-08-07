// 찰나의 숫자 — 물방울에 적힌 숫자를 짧게 보여 준 뒤 지우고, 잔상만으로 작은 수부터 순서대로 터뜨린다.
// 첫 물방울을 탭하는 순간에도 나머지 숫자가 지워진다 — 그러지 않으면 하나 누르고 다음 숫자를 읽는 식으로 넘어갈 수 있다.

export const BUBBLE_R = 56
// 물방울 중심이 놓이는 범위 (HUD와 화면 가장자리를 피한다)
const AREA = { x0: 100, x1: 620, y0: 330, y1: 1060 }

export type Phase = 'reveal' | 'recall' | 'penalty' | 'clear' | 'over'

export interface Bubble {
  n: number
  x: number
  y: number
  popped: boolean
  pop: number // 터지는 연출 진행도 0~1
  wrong: boolean
}

export interface FlashState {
  phase: Phase
  score: number
  level: number
  hearts: number
  bubbles: Bubble[]
  next: number // 다음에 눌러야 하는 숫자
  showTimer: number
  showSpan: number
  timer: number // penalty·clear 대기
  gain: number
  overTimer: number
  playTime: number
}

// 개수와 노출 시간, 두 축으로 난이도를 올린다
const bubbleCount = (level: number) => Math.min(9, 4 + Math.floor((level - 1) / 2))
const exposure = (level: number) => Math.max(0.45, 1.5 - (level - 1) * 0.07)
const levelPoints = (count: number) => 30 + count * 25

function layout(count: number): Bubble[] {
  const bubbles: Bubble[] = []
  for (let n = 1; n <= count; n++) {
    let x = 0
    let y = 0
    // 겹치지 않는 자리를 찾는다 (9개까지는 넉넉해서 몇 번 안에 잡힌다)
    for (let tries = 0; tries < 300; tries++) {
      x = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0)
      y = AREA.y0 + Math.random() * (AREA.y1 - AREA.y0)
      if (bubbles.every((b) => Math.hypot(b.x - x, b.y - y) >= BUBBLE_R * 2 + 14)) break
    }
    bubbles.push({ n, x, y, popped: false, pop: 0, wrong: false })
  }
  return bubbles
}

export function startLevel(state: FlashState) {
  state.bubbles = layout(bubbleCount(state.level))
  state.next = 1
  state.showSpan = exposure(state.level)
  state.showTimer = state.showSpan
  state.phase = 'reveal'
}

export function createState(): FlashState {
  const state: FlashState = {
    phase: 'reveal',
    score: 0,
    level: 1,
    hearts: 3,
    bubbles: [],
    next: 1,
    showTimer: 0,
    showSpan: 1,
    timer: 0,
    gain: 0,
    overTimer: 0,
    playTime: 0,
  }
  startLevel(state)
  return state
}

export function update(state: FlashState, dt: number) {
  for (const b of state.bubbles) if (b.popped && b.pop < 1) b.pop = Math.min(1, b.pop + dt * 3)

  if (state.phase === 'reveal') {
    state.showTimer -= dt
    if (state.showTimer <= 0) {
      state.showTimer = 0
      state.phase = 'recall'
    }
    return
  }
  if (state.phase !== 'penalty' && state.phase !== 'clear') return

  state.timer -= dt
  if (state.timer > 0) return
  if (state.phase === 'clear') {
    state.level += 1
    startLevel(state)
  } else if (state.hearts <= 0) {
    state.phase = 'over'
    state.overTimer = 0.6
  } else {
    startLevel(state) // 같은 단계를 다시
  }
}

export type TapResult = 'correct' | 'wrong' | 'clear'

export function tapAt(state: FlashState, x: number, y: number): TapResult | null {
  if (state.phase !== 'reveal' && state.phase !== 'recall') return null
  const hit = state.bubbles.find(
    (b) => !b.popped && Math.hypot(b.x - x, b.y - y) <= BUBBLE_R + 14,
  )
  if (!hit) return null

  if (hit.n !== state.next) {
    hit.wrong = true
    state.hearts = Math.max(0, state.hearts - 1)
    // 틀린 동안 숫자를 다시 보여 준다 — 무엇을 잘못 기억했는지 알려 주지 않으면 억울하다
    state.phase = 'penalty'
    state.timer = 1.2
    return 'wrong'
  }

  hit.popped = true
  hit.pop = 0
  state.next += 1
  state.phase = 'recall' // 첫 탭에 남은 숫자를 지운다
  state.showTimer = 0
  if (state.next > state.bubbles.length) {
    state.gain = levelPoints(state.bubbles.length)
    state.score = Math.min(1_000_000, state.score + state.gain)
    state.phase = 'clear'
    state.timer = 0.7
    return 'clear'
  }
  return 'correct'
}

// 광고 보상: 하트 2개를 받고 지금 단계부터 다시 (쌓아 둔 점수는 그대로)
export function reviveAtLevel(state: FlashState) {
  state.hearts = 2
  state.timer = 0
  startLevel(state)
}
