// 숫자 줄 세우기 — 1~999 카드를 위에서 아래로 커지도록 빈 칸에 끼워 넣는다.
// 넣을 수 있는 칸이 없으면 끝. 판단은 "여기 넣으면 나중에 막히지 않을까" 하나뿐이다.

export const SLOTS = 16
const MAX_VALUE = 999
const CLEAR_BONUS = 300

export interface NumState {
  phase: 'playing' | 'over'
  score: number
  round: number
  slots: Array<number | null>
  card: number
  focusSlot: number // 방금 놓은 칸 / 광고로 비운 칸 (강조 연출)
  focusTimer: number
  rejectSlot: number // 넣을 수 없는 칸을 눌렀을 때
  rejectTimer: number
  clearFlash: number
  clearGain: number
  overTimer: number
  playTime: number
}

// 위에서 아래로 커져야 하므로 위쪽 가장 가까운 숫자보다 크고 아래쪽 가장 가까운 숫자보다 작아야 한다
export function canPlace(slots: Array<number | null>, index: number, card: number): boolean {
  if (slots[index] !== null) return false
  for (let k = index - 1; k >= 0; k--) {
    const v = slots[k]
    if (v !== null) {
      if (v >= card) return false
      break
    }
  }
  for (let k = index + 1; k < slots.length; k++) {
    const v = slots[k]
    if (v !== null) {
      if (v <= card) return false
      break
    }
  }
  return true
}

export function legalSlots(state: NumState): boolean[] {
  return state.slots.map((_, i) => canPlace(state.slots, i, state.card))
}

const hasAnyPlace = (slots: Array<number | null>, card: number) =>
  slots.some((_, i) => canPlace(slots, i, card))

// 같은 숫자는 어느 칸에도 못 들어가므로(등호 불가) 이미 쓴 값은 피한다
function drawCard(slots: Array<number | null>): number {
  const used = new Set(slots)
  let card = 0
  do {
    card = 1 + Math.floor(Math.random() * MAX_VALUE)
  } while (used.has(card))
  return card
}

export function createState(): NumState {
  const slots: Array<number | null> = Array(SLOTS).fill(null)
  return {
    phase: 'playing',
    score: 0,
    round: 1,
    slots,
    card: drawCard(slots),
    focusSlot: -1,
    focusTimer: 0,
    rejectSlot: -1,
    rejectTimer: 0,
    clearFlash: 0,
    clearGain: 0,
    overTimer: 0,
    playTime: 0,
  }
}

export function update(state: NumState, dt: number) {
  state.focusTimer = Math.max(0, state.focusTimer - dt)
  state.rejectTimer = Math.max(0, state.rejectTimer - dt)
  state.clearFlash = Math.max(0, state.clearFlash - dt)
}

export type PlaceResult = 'placed' | 'cleared' | 'over' | 'rejected'

export function place(state: NumState, index: number): PlaceResult | null {
  if (state.phase !== 'playing') return null
  if (!canPlace(state.slots, index, state.card)) {
    if (state.slots[index] === null) {
      state.rejectSlot = index
      state.rejectTimer = 0.35
      return 'rejected'
    }
    return null
  }

  state.slots[index] = state.card
  state.focusSlot = index
  state.focusTimer = 0.4
  const filled = state.slots.filter((v) => v !== null).length
  // 뒤로 갈수록 넣기 어려워지므로 점수도 같이 올린다 (한 판 다 채우면 2,400점)
  state.score = Math.min(1_000_000, state.score + 60 + (filled - 1) * 12)

  if (filled === SLOTS) {
    state.round += 1
    state.score = Math.min(1_000_000, state.score + CLEAR_BONUS)
    state.clearGain = CLEAR_BONUS
    state.clearFlash = 1.4
    state.slots = Array(SLOTS).fill(null)
    state.focusSlot = -1
    state.card = drawCard(state.slots)
    return 'cleared'
  }

  state.card = drawCard(state.slots)
  if (!hasAnyPlace(state.slots, state.card)) {
    state.phase = 'over'
    state.overTimer = 1.1 // 왜 막혔는지 보이도록 카드를 잠시 그대로 둔다
    return 'over'
  }
  return 'placed'
}

// 광고 보상: 막힘의 원인이 된 칸을 비운다.
// 지금 카드와 값이 가장 가까운 숫자가 곧 범인이므로 그 순서로 비워 보고 길이 열리면 멈춘다.
export function clearBlockingSlot(state: NumState): boolean {
  const filled = state.slots
    .map((value, index) => ({ value, index }))
    .filter((s): s is { value: number; index: number } => s.value !== null)
    .sort((a, b) => Math.abs(a.value - state.card) - Math.abs(b.value - state.card))

  for (const slot of filled) {
    state.slots[slot.index] = null
    if (hasAnyPlace(state.slots, state.card)) {
      state.phase = 'playing'
      state.focusSlot = slot.index
      state.focusTimer = 0.8
      return true
    }
    state.slots[slot.index] = slot.value
  }
  return false
}
