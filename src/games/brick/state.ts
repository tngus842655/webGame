import { LAYOUT, MAX_ROWS, WAVE } from './config'

export type Phase = 'aiming' | 'flying' | 'over'

// item — 부수면 공격력이 1 오른다
// bomb — 부수면 둘레 여덟 칸에 제 최대 HP만큼 데미지. 폭발에 휘말린 폭탄은 같이 터진다
export type BrickKind = 'plain' | 'item' | 'bomb'

export interface Brick {
  col: number
  row: number
  hp: number
  maxHp: number
  kind: BrickKind
}

function rollKind(): BrickKind {
  const r = Math.random()
  if (r < WAVE.itemChance) return 'item'
  if (r < WAVE.itemChance + WAVE.bombChance) return 'bomb'
  return 'plain'
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
}

export interface Popup {
  x: number
  y: number
  text: string
  age: number
}

export interface Flash {
  x: number
  y: number
  w: number
  h: number
  age: number
}

export const POPUP_DURATION = 0.8
export const FLASH_DURATION = 0.3

export interface BrickState {
  phase: Phase
  wave: number
  score: number
  launchX: number
  aim: { dx: number; dy: number } | null // 정규화된 발사 방향
  bricks: Brick[]
  balls: Ball[]
  toLaunch: number
  launchTimer: number
  firstLandedX: number | null
  // 공 1개당 타격 데미지. 아이템 벽돌로만 오르고 판이 끝나면 1로 돌아간다 —
  // 이전 판의 성장이 남으면 순위표가 실력이 아니라 누적 플레이 시간을 재게 된다.
  attack: number
  popups: Popup[]
  flashes: Flash[]
  hintTime: number // 조작 힌트 애니메이션용
}

function spawnRow(state: BrickState) {
  const count =
    WAVE.minBricks + Math.floor(Math.random() * (WAVE.maxBricks - WAVE.minBricks + 1))
  const cols = Array.from({ length: LAYOUT.cols }, (_, i) => i)
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cols[i], cols[j]] = [cols[j], cols[i]]
  }
  for (const col of cols.slice(0, count)) {
    const base = Math.ceil(state.wave * WAVE.hpGrowth)
    const hp = base * (Math.random() < WAVE.doubleHpChance ? 2 : 1)
    state.bricks.push({ col, row: 0, hp, maxHp: hp, kind: rollKind() })
  }
}

export function createState(): BrickState {
  const state: BrickState = {
    phase: 'aiming',
    wave: 1,
    score: 0,
    launchX: LAYOUT.width / 2,
    aim: null,
    bricks: [],
    balls: [],
    toLaunch: 0,
    launchTimer: 0,
    firstLandedX: null,
    attack: 1,
    popups: [],
    flashes: [],
    hintTime: 0,
  }
  spawnRow(state)
  return state
}

// 턴 종료: 줄을 한 칸 내리고 새 줄 생성. 바닥 도달 시 true(게임오버)
export function advanceWave(state: BrickState): boolean {
  for (const b of state.bricks) b.row += 1
  if (state.bricks.some((b) => b.row >= MAX_ROWS)) {
    state.phase = 'over'
    return true
  }
  state.wave += 1
  spawnRow(state)
  return false
}

// 광고 보상: 바닥 근처 3줄 제거 후 재개
export function clearDangerRows(state: BrickState) {
  state.bricks = state.bricks.filter((b) => b.row < MAX_ROWS - 3)
}

export function updateEffects(state: BrickState, dt: number) {
  state.hintTime += dt
  for (const p of state.popups) {
    p.age += dt
    p.y -= 60 * dt
  }
  for (const f of state.flashes) f.age += dt
  state.popups = state.popups.filter((p) => p.age < POPUP_DURATION)
  state.flashes = state.flashes.filter((f) => f.age < FLASH_DURATION)
}
