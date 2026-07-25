import { BOARD, TIERS } from './config'

export type Phase = 'playing' | 'over'

export interface Pop {
  x: number
  y: number
  r: number
  age: number
}

export interface Popup {
  x: number
  y: number
  text: string
  age: number
}

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  color: string
}

export const POP_DURATION = 0.35
export const POPUP_DURATION = 0.8
export const SPARK_DURATION = 0.5

export interface SuikaState {
  phase: Phase
  score: number
  currentTier: number
  nextTier: number
  aimX: number
  cooldown: number
  dangerTime: number
  pops: Pop[]
  popups: Popup[]
  sparks: Spark[]
}

export function pickDropTier(): number {
  const total = TIERS.reduce((sum, t) => sum + t.dropWeight, 0)
  let r = Math.random() * total
  for (let i = 0; i < TIERS.length; i++) {
    r -= TIERS[i].dropWeight
    if (r < 0) return i
  }
  return 0
}

export function createState(): SuikaState {
  return {
    phase: 'playing',
    score: 0,
    currentTier: pickDropTier(),
    nextTier: pickDropTier(),
    aimX: (BOARD.wallLeft + BOARD.wallRight) / 2,
    cooldown: 0,
    dangerTime: 0,
    pops: [],
    popups: [],
    sparks: [],
  }
}

export function updateEffects(state: SuikaState, dt: number) {
  for (const p of state.pops) p.age += dt
  for (const p of state.popups) {
    p.age += dt
    p.y -= 60 * dt
  }
  for (const s of state.sparks) {
    s.age += dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vy += 900 * dt
  }
  state.pops = state.pops.filter((p) => p.age < POP_DURATION)
  state.popups = state.popups.filter((p) => p.age < POPUP_DURATION)
  state.sparks = state.sparks.filter((s) => s.age < SPARK_DURATION)
}
