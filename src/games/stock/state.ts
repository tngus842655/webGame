// 모의 주식 타이쿤 — 90초 트레이딩, 뉴스 이벤트, 수익이 곧 점수

export const START_CASH = 1_000_000
export const START_PRICE = 10_000
export const TICK_SECONDS = 0.5
export const ROUND_SECONDS = 90
export const HISTORY_LEN = 120

export type Phase = 'playing' | 'over'

import type { TranslationKey } from '@/shared/i18n'

export interface NewsEvent {
  text: TranslationKey
  drift: number
  duration: number
}

export const EVENTS: NewsEvent[] = [
  { text: 'stock.ev1', drift: 0.015, duration: 8 },
  { text: 'stock.ev2', drift: 0.02, duration: 6 },
  { text: 'stock.ev3', drift: -0.015, duration: 8 },
  { text: 'stock.ev4', drift: -0.02, duration: 6 },
  { text: 'stock.ev5', drift: 0.045, duration: 3 },
  { text: 'stock.ev6', drift: -0.045, duration: 3 },
]

export interface StockState {
  phase: Phase
  timeLeft: number
  tickTimer: number
  price: number
  history: number[]
  cash: number
  qty: number
  drift: number
  eventText: TranslationKey | ''
  eventTimer: number
  nextEventIn: number
}

export function assetOf(state: StockState): number {
  return Math.round(state.cash + state.qty * state.price)
}

// 점수 = 수익(원) / 100 → 10만 원 수익 = 1,000점
export function scoreOf(state: StockState): number {
  return Math.max(0, Math.round((assetOf(state) - START_CASH) / 100))
}

export function createState(): StockState {
  return {
    phase: 'playing',
    timeLeft: ROUND_SECONDS,
    tickTimer: 0,
    price: START_PRICE,
    history: [START_PRICE],
    cash: START_CASH,
    qty: 0,
    drift: 0,
    eventText: '',
    eventTimer: 0,
    nextEventIn: 6 + Math.random() * 6,
  }
}

export function tick(state: StockState) {
  const noise = (Math.random() - 0.5) * 0.05
  state.price = Math.max(100, Math.round(state.price * (1 + state.drift + noise)))
  state.history.push(state.price)
  if (state.history.length > HISTORY_LEN) state.history.shift()
}

// true를 반환하면 라운드 종료
export function update(state: StockState, dt: number): boolean {
  state.timeLeft -= dt
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.phase = 'over'
    return true
  }

  state.tickTimer += dt
  while (state.tickTimer >= TICK_SECONDS) {
    state.tickTimer -= TICK_SECONDS
    tick(state)
  }

  if (state.eventTimer > 0) {
    state.eventTimer -= dt
    if (state.eventTimer <= 0) {
      state.drift = 0
      state.eventText = ''
    }
  } else {
    state.nextEventIn -= dt
    if (state.nextEventIn <= 0) {
      const event = EVENTS[Math.floor(Math.random() * EVENTS.length)]
      state.drift = event.drift
      state.eventText = event.text
      state.eventTimer = event.duration
      state.nextEventIn = 10 + Math.random() * 8
    }
  }
  return false
}

// portion: 0~1 (가진 현금/보유량 중 사용 비율)
export function buy(state: StockState, portion: number): boolean {
  const budget = state.cash * portion
  const amount = Math.floor(budget / state.price)
  if (amount <= 0) return false
  state.qty += amount
  state.cash -= amount * state.price
  return true
}

export function sell(state: StockState, portion: number): boolean {
  const amount = portion >= 1 ? state.qty : Math.floor(state.qty * portion)
  if (amount <= 0) return false
  state.qty -= amount
  state.cash += amount * state.price
  return true
}
