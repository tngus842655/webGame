// 부동산 타이쿤 — 제한 시간 동안 매물을 사고팔고 임대료를 모아 총자산을 불린다.
// 시세는 1초 틱 랜덤워크 + 호재/악재 이벤트. 상위 매물일수록 변동성과 수익률이 높다.

export type Phase = 'playing' | 'over'

// 매물 정의: 기준가·틱 변동성·초당 임대 수익률(기준가 대비)
export const PROPS = [
  { base: 50, vol: 0.04, rate: 0.022 },
  { base: 200, vol: 0.05, rate: 0.024 },
  { base: 800, vol: 0.06, rate: 0.026 },
  { base: 3_000, vol: 0.07, rate: 0.028 },
  { base: 12_000, vol: 0.08, rate: 0.03 },
  { base: 50_000, vol: 0.09, rate: 0.032 },
] as const

export interface Property {
  price: number
  owned: number
  lastChange: number // 직전 틱 변동률 (표시용)
}

export interface EstateEvent {
  up: boolean
  target: number // 매물 인덱스, -1 = 전체
  age: number
}

export interface EstateState {
  phase: Phase
  cash: number
  timeLeft: number
  properties: Property[]
  tickTimer: number
  eventTimer: number
  event: EstateEvent | null
  overTimer: number
  playTime: number
}

export function createState(): EstateState {
  return {
    phase: 'playing',
    cash: 200,
    timeLeft: 180,
    properties: PROPS.map((p) => ({ price: p.base, owned: 0, lastChange: 0 })),
    tickTimer: 1,
    eventTimer: 14,
    event: null,
    overTimer: 0,
    playTime: 0,
  }
}

export function totalAssets(state: EstateState): number {
  let sum = state.cash
  for (let i = 0; i < state.properties.length; i++) {
    sum += state.properties[i].owned * state.properties[i].price
  }
  return Math.floor(sum)
}

export interface TickEvents {
  event: boolean // 새 이벤트 발생 (배너·사운드)
  timeUp: boolean
}

export function update(state: EstateState, dt: number): TickEvents {
  const events: TickEvents = { event: false, timeUp: false }
  if (state.phase !== 'playing') return events

  state.timeLeft -= dt
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.phase = 'over'
    state.overTimer = 0.8
    events.timeUp = true
    return events
  }

  // 임대 수익: 기준가 대비 고정 수익률 (시세와 무관한 안정 수입)
  for (let i = 0; i < state.properties.length; i++) {
    state.cash += state.properties[i].owned * PROPS[i].base * PROPS[i].rate * dt
  }

  // 1초 틱 시세 변동
  state.tickTimer -= dt
  if (state.tickTimer <= 0) {
    state.tickTimer = 1
    for (let i = 0; i < state.properties.length; i++) {
      const p = state.properties[i]
      // 랜덤워크 + 기준가로의 평균 회귀 — 폭락 매물은 서서히 회복한다
      const change = (Math.random() * 2 - 1) * PROPS[i].vol + (1 - p.price / PROPS[i].base) * 0.02
      p.price = Math.max(PROPS[i].base * 0.3, Math.min(PROPS[i].base * 6, p.price * (1 + change)))
      p.lastChange = change
    }
  }

  // 호재/악재 이벤트
  if (state.event) {
    state.event.age += dt
    if (state.event.age > 4) state.event = null
  }
  state.eventTimer -= dt
  if (state.eventTimer <= 0) {
    state.eventTimer = 12 + Math.random() * 8
    const global = Math.random() < 0.4
    const up = Math.random() < 0.5
    if (global) {
      const k = 0.1 + Math.random() * 0.1
      for (const p of state.properties) p.price *= up ? 1 + k : 1 - k
      state.event = { up, target: -1, age: 0 }
    } else {
      const i = Math.floor(Math.random() * state.properties.length)
      const k = 0.2 + Math.random() * 0.25
      state.properties[i].price *= up ? 1 + k : 1 - k
      state.event = { up, target: i, age: 0 }
    }
    events.event = true
  }
  return events
}

export function buy(state: EstateState, index: number): boolean {
  if (state.phase !== 'playing') return false
  const p = state.properties[index]
  if (state.cash < p.price) return false
  state.cash -= p.price
  p.owned += 1
  return true
}

export function sell(state: EstateState, index: number): boolean {
  if (state.phase !== 'playing') return false
  const p = state.properties[index]
  if (p.owned <= 0) return false
  state.cash += p.price
  p.owned -= 1
  return true
}
