// 탑 쌓기 — 좌우로 왕복하는 블록을 탭해 꼭대기에 얹는다.
// 어긋난 만큼 폭이 깎이고 다음 블록은 그 좁아진 폭으로 시작한다. 폭이 남지 않으면 끝.
// 정확히 맞추면 깎이지 않고 조금 돌아온다 — 폭 자체가 남은 수명 게이지라 화면만 봐도 여유가 보인다.

export type Phase = 'playing' | 'over'

export interface Block {
  x: number // 중심
  w: number
}

// 어긋나서 떨어져 나가는 조각
export interface Chip {
  x: number
  y: number
  w: number
  hue: number
  vx: number
  spin: number
  age: number
}

export interface StackState {
  phase: Phase
  score: number
  blocks: Block[] // 아래에서 위로
  moving: { x: number; w: number; dir: 1 | -1 }
  chips: Chip[]
  combo: number // 연속 정확히 맞춘 횟수
  perfectFlash: number
  camY: number
  overTimer: number
  playTime: number
}

export const BLOCK_H = 54
export const START_W = 300
export const BASE_Y = 1180 // 1층 블록의 아랫변 (월드 좌표)
export const TOP_SCREEN_Y = 820 // 꼭대기를 이 높이에 두고 카메라가 따라 올라간다
const MARGIN = 30
const PERFECT_TOL = 6
const MIN_W = 18 // 이보다 좁아지면 무너진 것으로 본다

const speed = (floor: number) => Math.min(640, 250 + floor * 9)

export const worldTopY = (state: StackState) => BASE_Y - state.blocks.length * BLOCK_H
export const movingY = (state: StackState) => worldTopY(state) - BLOCK_H

export function createState(): StackState {
  return {
    phase: 'playing',
    score: 0,
    blocks: [{ x: 360, w: START_W }],
    moving: { x: MARGIN + START_W / 2, w: START_W, dir: 1 },
    chips: [],
    combo: 0,
    perfectFlash: 0,
    camY: 0,
    overTimer: 0,
    playTime: 0,
  }
}

export function update(state: StackState, dt: number) {
  state.perfectFlash = Math.max(0, state.perfectFlash - dt)

  for (let i = state.chips.length - 1; i >= 0; i--) {
    const chip = state.chips[i]
    chip.age += dt
    chip.x += chip.vx * dt
    chip.y += 900 * chip.age * dt
    if (chip.age > 1.1) state.chips.splice(i, 1)
  }

  // 카메라는 목표 높이를 부드럽게 따라간다 (층이 오를 때 화면이 튀지 않도록)
  const target = Math.max(0, TOP_SCREEN_Y - worldTopY(state))
  state.camY += (target - state.camY) * Math.min(1, dt * 7)

  if (state.phase !== 'playing') return
  const { moving } = state
  moving.x += speed(state.blocks.length) * moving.dir * dt
  // 벽에 붙지 않고 화면 안에서 왕복한다 — 폭이 좁아질수록 왕복 폭이 넓어져 완전히 빗나갈 수도 있다
  const left = MARGIN + moving.w / 2
  const right = 720 - MARGIN - moving.w / 2
  if (moving.x <= left) {
    moving.x = left
    moving.dir = 1
  } else if (moving.x >= right) {
    moving.x = right
    moving.dir = -1
  }
}

export interface PlaceResult {
  perfect: boolean
  over: boolean
  gained: number
}

// 탭: 지금 위치에 블록을 얹는다
export function place(state: StackState): PlaceResult | null {
  if (state.phase !== 'playing') return null
  const top = state.blocks[state.blocks.length - 1]
  const { moving } = state
  const offset = moving.x - top.x
  const hue = state.blocks.length * 11

  const overlap = moving.w - Math.abs(offset)
  if (overlap < MIN_W) {
    // 얹을 자리가 남지 않았다 — 블록이 통째로 떨어져 나간다
    state.chips.push({ x: moving.x, y: movingY(state), w: moving.w, hue, vx: offset > 0 ? 220 : -220, spin: offset > 0 ? 3 : -3, age: 0 })
    state.phase = 'over'
    state.overTimer = 0.9
    state.combo = 0
    return { perfect: false, over: true, gained: 0 }
  }

  const perfect = Math.abs(offset) <= PERFECT_TOL
  if (perfect) {
    state.combo += 1
    state.perfectFlash = 0.5
    // 정확히 맞추면 깎이지 않고 조금 돌아온다 (처음 폭을 넘지는 않는다)
    state.blocks.push({ x: top.x, w: Math.min(START_W, moving.w + 6) })
  } else {
    state.combo = 0
    const w = overlap
    const x = moving.x - offset / 2 // 겹친 구간의 중심
    // 삐져나온 조각은 어긋난 쪽으로 떨어진다
    state.chips.push({
      x: offset > 0 ? x + w / 2 + Math.abs(offset) / 2 : x - w / 2 - Math.abs(offset) / 2,
      y: movingY(state),
      w: Math.abs(offset),
      hue,
      vx: offset > 0 ? 120 : -120,
      spin: offset > 0 ? 2.2 : -2.2,
      age: 0,
    })
    state.blocks.push({ x, w })
  }

  const gained = perfect ? 10 + Math.min(state.combo, 10) * 4 : 10
  state.score = Math.min(1_000_000, state.score + gained)

  const next = state.blocks[state.blocks.length - 1]
  state.moving = { x: moving.dir > 0 ? 720 - MARGIN - next.w / 2 : MARGIN + next.w / 2, w: next.w, dir: moving.dir > 0 ? -1 : 1 }
  return { perfect, over: false, gained }
}

// 광고 보상: 폭을 처음의 절반까지 되돌려 그 자리에서 이어한다
export function reviveWithHalfWidth(state: StackState) {
  state.chips = []
  const top = state.blocks[state.blocks.length - 1]
  const w = Math.max(top.w, START_W / 2)
  top.w = w
  state.combo = 0
  state.phase = 'playing'
  state.moving = { x: MARGIN + w / 2, w, dir: 1 }
}
