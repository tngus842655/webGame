// 같은 그림 찾기 — 위아래 두 원판에 공통으로 들어 있는 그림 하나를 찾아 탭한다.
// 한 라운드가 2~3초라 리듬이 아주 빠르다. 시간 게이지가 다하면 끝.

import { SYMBOLS } from './symbols'

export const DISC_R = 248
export const DISCS = [
  { x: 360, y: 420 },
  { x: 360, y: 950 },
]
export const GAUGE_MAX = 20
const GAUGE_GAIN = 1.6
const GAUGE_PENALTY = 2
const TAU = Math.PI * 2

export interface Placed {
  sym: number // SYMBOLS 인덱스
  x: number // 원판 중심 기준
  y: number
  r: number
  rot: number
}

export interface SameState {
  phase: 'playing' | 'resolve' | 'over'
  score: number
  combo: number
  round: number
  gauge: number
  discs: Placed[][] // [위, 아래]
  answer: number
  resolveTimer: number
  wrongFlash: number
  wrongAt: { x: number; y: number } | null
  overTimer: number
  playTime: number
}

const symbolCount = (round: number) => (round < 6 ? 6 : round < 14 ? 7 : 8)

// 원판 안에 12px 이상 띄워 흩어 놓는다 (8개까지는 넉넉해서 몇 번 안에 자리가 잡힌다).
// 심볼 반지름 30~42px = 터치 타깃 60~84px.
function placeAll(syms: number[]): Placed[] {
  const out: Placed[] = []
  for (const sym of syms) {
    const r = 30 + Math.random() * 12
    let x = 0
    let y = 0
    for (let tries = 0; tries < 400; tries++) {
      const a = Math.random() * TAU
      const d = Math.sqrt(Math.random()) * (DISC_R - r - 18)
      x = Math.cos(a) * d
      y = Math.sin(a) * d
      if (out.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 12)) break
    }
    out.push({ sym, x, y, r, rot: (Math.random() - 0.5) })
  }
  return out
}

function newRound(state: SameState) {
  const count = symbolCount(state.round)
  const pool = SYMBOLS.map((_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // 공통 심볼 하나 + 나머지는 서로 겹치지 않게 나눠 담아 정답이 정확히 하나가 되게 한다
  const answer = pool[0]
  const top = [answer, ...pool.slice(1, count)]
  const bottom = [answer, ...pool.slice(count, count * 2 - 1)]
  state.answer = answer
  state.discs = [placeAll(top), placeAll(bottom)]
}

export function createState(): SameState {
  const state: SameState = {
    phase: 'playing',
    score: 0,
    combo: 0,
    round: 1,
    gauge: GAUGE_MAX,
    discs: [],
    answer: 0,
    resolveTimer: 0,
    wrongFlash: 0,
    wrongAt: null,
    overTimer: 0,
    playTime: 0,
  }
  newRound(state)
  return state
}

export function update(state: SameState, dt: number) {
  state.wrongFlash = Math.max(0, state.wrongFlash - dt)

  if (state.phase === 'resolve') {
    state.resolveTimer -= dt
    if (state.resolveTimer <= 0) {
      state.round += 1
      newRound(state)
      state.phase = 'playing'
    }
    return
  }
  if (state.phase !== 'playing') return

  state.gauge -= dt
  if (state.gauge <= 0) {
    state.gauge = 0
    state.phase = 'over'
    state.overTimer = 0.7
  }
}

export type TapResult = 'correct' | 'wrong'

export function tapAt(state: SameState, x: number, y: number): TapResult | null {
  if (state.phase !== 'playing') return null
  for (let d = 0; d < DISCS.length; d++) {
    const disc = DISCS[d]
    const lx = x - disc.x
    const ly = y - disc.y
    if (Math.hypot(lx, ly) > DISC_R) continue
    const hit = state.discs[d].find((p) => Math.hypot(p.x - lx, p.y - ly) <= p.r + 8)
    if (!hit) return null

    if (hit.sym === state.answer) {
      state.combo += 1
      state.score = Math.min(1_000_000, state.score + 30 + 5 * Math.min(state.combo - 1, 10))
      state.gauge = Math.min(GAUGE_MAX, state.gauge + GAUGE_GAIN)
      state.phase = 'resolve'
      state.resolveTimer = 0.42
      return 'correct'
    }
    state.combo = 0
    state.gauge = Math.max(0, state.gauge - GAUGE_PENALTY)
    state.wrongFlash = 0.4
    state.wrongAt = { x: disc.x + hit.x, y: disc.y + hit.y }
    if (state.gauge <= 0) {
      state.phase = 'over'
      state.overTimer = 0.7
    }
    return 'wrong'
  }
  return null
}

// 광고 보상: 10초를 받고 콤보는 절반만 남긴다 (콤보가 한창일 때 끊기는 구조라 절반이라도 이어진다)
export function reviveWithTime(state: SameState) {
  state.gauge = Math.min(GAUGE_MAX, state.gauge + 10)
  state.combo = Math.floor(state.combo / 2)
  state.wrongFlash = 0
  state.phase = 'playing'
}
