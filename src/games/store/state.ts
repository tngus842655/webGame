// 편의점 운영 — 손님이 원하는 상품을 제때 진열해 파는 멀티태스킹 타이쿤.
// 진열대가 비면 손님이 화내고 평판이 깎인다. 평판 0이면 폐업(게임 오버).

export type Phase = 'playing' | 'over'
export type CustomerMood = 'in' | 'wait' | 'happy' | 'angry'

// 상품: 발주 원가·판매가 (발주는 10개 단위, 배송 6초)
export const PRODUCTS = [
  { cost: 50, price: 80 },
  { cost: 70, price: 110 },
  { cost: 60, price: 100 },
  { cost: 40, price: 70 },
] as const

export const SHELF_CAP = 5
export const ORDER_UNITS = 10
export const DELIVERY_TIME = 6
const patienceAt = (t: number) => Math.max(2, 4 - t * 0.007)

export interface Shelf {
  display: number // 진열된 수량
  stock: number // 창고 재고
}

export interface Customer {
  product: number
  mood: CustomerMood
  t: number // 현재 상태 경과 시간
  patience: number
  slot: number // 같은 진열대 앞 대기 위치 (표시용)
}

export interface Order {
  product: number
  timer: number
}

export interface StoreState {
  phase: Phase
  revenue: number // 누적 판매액 = 점수
  cash: number
  rep: number // 평판 (하트)
  time: number
  shelves: Shelf[]
  orders: Order[]
  customers: Customer[]
  spawnTimer: number
  overTimer: number
  playTime: number
}

export function createState(): StoreState {
  return {
    phase: 'playing',
    revenue: 0,
    cash: 1500,
    rep: 5,
    time: 0,
    shelves: PRODUCTS.map(() => ({ display: SHELF_CAP, stock: SHELF_CAP })),
    orders: [],
    customers: [],
    spawnTimer: 2,
    overTimer: 0,
    playTime: 0,
  }
}

export interface TickEvents {
  sales: number[] // 이번 프레임에 팔린 상품 인덱스 (연출용)
  angry: boolean
  delivered: boolean
}

// 하한 0.35초는 초당 3회 남짓이라 손이 빠른 사람은 영영 안 망했다.
// 사람이 낼 수 있는 탭 속도 바깥까지 조여 판이 끝나게 한다.
const spawnInterval = (t: number) => Math.max(0.22, 3.2 - t * 0.009)
const WALK_IN = 1.0
const LEAVE = 0.9

export function update(state: StoreState, dt: number): TickEvents {
  const events: TickEvents = { sales: [], angry: false, delivered: false }
  if (state.phase !== 'playing') return events
  state.time += dt

  // 손님 입장
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = spawnInterval(state.time)
    const product = Math.floor(Math.random() * PRODUCTS.length)
    const slot = state.customers.filter((c) => c.product === product && c.mood !== 'happy' && c.mood !== 'angry').length
    state.customers.push({ product, mood: 'in', t: 0, patience: patienceAt(state.time), slot })
  }

  // 배송 도착
  for (let i = state.orders.length - 1; i >= 0; i--) {
    state.orders[i].timer -= dt
    if (state.orders[i].timer <= 0) {
      state.shelves[state.orders[i].product].stock += ORDER_UNITS
      state.orders.splice(i, 1)
      events.delivered = true
    }
  }

  // 손님 상태 진행
  for (let i = state.customers.length - 1; i >= 0; i--) {
    const customer = state.customers[i]
    customer.t += dt
    if (customer.mood === 'in') {
      if (customer.t >= WALK_IN) {
        customer.mood = 'wait'
        customer.t = 0
      }
    } else if (customer.mood === 'wait') {
      const shelf = state.shelves[customer.product]
      if (shelf.display > 0) {
        shelf.display -= 1
        state.cash += PRODUCTS[customer.product].price
        state.revenue = Math.min(1_000_000, state.revenue + PRODUCTS[customer.product].price)
        customer.mood = 'happy'
        customer.t = 0
        events.sales.push(customer.product)
      } else if (customer.t >= customer.patience) {
        customer.mood = 'angry'
        customer.t = 0
        state.rep -= 1
        events.angry = true
      }
    } else if (customer.t >= LEAVE) {
      state.customers.splice(i, 1)
    }
  }

  if (state.rep <= 0) {
    state.rep = 0
    state.phase = 'over'
    state.overTimer = 0.9
  }
  return events
}

// 진열: 창고 재고를 진열대로 채운다
export function restock(state: StoreState, index: number): boolean {
  if (state.phase !== 'playing') return false
  const shelf = state.shelves[index]
  const move = Math.min(SHELF_CAP - shelf.display, shelf.stock)
  if (move <= 0) return false
  shelf.display += move
  shelf.stock -= move
  return true
}

// 발주: 원가 × 10개, 배송까지 6초
export function order(state: StoreState, index: number): boolean {
  if (state.phase !== 'playing') return false
  const cost = PRODUCTS[index].cost * ORDER_UNITS
  if (state.cash < cost) return false
  state.cash -= cost
  state.orders.push({ product: index, timer: DELIVERY_TIME })
  return true
}
