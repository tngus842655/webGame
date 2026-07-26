// 국가 운영 — 신하들의 안건 카드에 좌/우 선택으로 답하며 네 지표의 균형을 지킨다.
// 어느 지표든 0(붕괴)이나 100(과잉)에 닿으면 퇴위. 점수 = 재위 년수(넘긴 카드 수).

export type Phase = 'playing' | 'dying' | 'over'

export const STAT_COUNT = 4 // 민심 · 국고 · 군사 · 외교

// 효과 순서: [민심, 국고, 군사, 외교]
export interface CardDef {
  icon: string
  n: number // i18n 키 번호 (rg.c{n}, rg.c{n}l, rg.c{n}r)
  l: [number, number, number, number]
  r: [number, number, number, number]
}

export const CARDS: CardDef[] = [
  { icon: '👨‍🌾', n: 1, l: [12, -12, 0, 0], r: [-12, 8, 0, 0] },
  { icon: '⚔️', n: 2, l: [0, -10, 14, -6], r: [0, -4, 0, 12] },
  { icon: '💰', n: 3, l: [-8, 14, 0, 0], r: [6, -4, 0, 0] },
  { icon: '🕊️', n: 4, l: [0, 6, 0, 14], r: [0, 0, 0, -12] },
  { icon: '👨‍🌾', n: 5, l: [14, -12, 0, 0], r: [-14, 0, 0, 0] },
  { icon: '⚔️', n: 6, l: [0, -8, 12, 0], r: [0, 0, -4, 0] },
  { icon: '💰', n: 7, l: [-12, 16, 0, 0], r: [4, -4, 0, 0] },
  { icon: '🕊️', n: 8, l: [0, -6, 0, 12], r: [0, 0, 0, -10] },
  { icon: '👥', n: 9, l: [14, -10, 0, 0], r: [-8, 2, 0, 0] },
  { icon: '⚔️', n: 10, l: [0, 0, -10, 0], r: [-4, 0, 6, 0] },
  { icon: '💰', n: 11, l: [-6, 16, 0, 0], r: [8, 4, 0, 0] },
  { icon: '🕊️', n: 12, l: [-8, -12, 0, 10], r: [6, 0, 0, -14] },
  { icon: '👨‍🌾', n: 13, l: [10, -10, 0, 0], r: [-12, 0, 0, 0] },
  { icon: '⚔️', n: 14, l: [0, -12, 10, 0], r: [0, 0, -12, 0] },
  { icon: '💰', n: 15, l: [-6, -12, 0, 8], r: [8, 0, 0, -4] },
  { icon: '🕊️', n: 16, l: [0, -4, 0, 10], r: [0, 0, 0, -8] },
  { icon: '👥', n: 17, l: [-10, 0, 4, 0], r: [10, 0, -4, 0] },
  { icon: '⚔️', n: 18, l: [6, -6, 6, 0], r: [-4, -2, 0, 0] },
  { icon: '💰', n: 19, l: [12, -8, 0, 0], r: [-10, 4, 0, 0] },
  { icon: '🕊️', n: 20, l: [0, -10, 0, 12], r: [0, -2, 0, -6] },
  { icon: '👥', n: 21, l: [10, -12, 0, 6], r: [-6, 0, 0, 0] },
  { icon: '⚔️', n: 22, l: [0, -10, 10, 0], r: [2, 0, -8, 0] },
  { icon: '💰', n: 23, l: [-6, 12, 0, 0], r: [6, -6, 0, 0] },
  { icon: '🕊️', n: 24, l: [4, -4, 0, -10], r: [-6, 0, 0, 8] },
]

export interface ReignsState {
  phase: Phase
  stats: number[] // 각 0~100, 50 시작
  years: number // 점수
  card: number // 현재 카드 인덱스
  deck: number[] // 남은 카드 순서 (다 쓰면 다시 섞는다)
  deadStat: number // 퇴위 원인 지표
  deadHigh: boolean // 과잉(100)으로 죽었는지
  slide: number // 카드 등장 연출 (1→0)
  overTimer: number
  playTime: number
}

function shuffledDeck(exclude: number): number[] {
  const deck = CARDS.map((_, i) => i).filter((i) => i !== exclude)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function createState(): ReignsState {
  const deck = shuffledDeck(-1)
  return {
    phase: 'playing',
    stats: [50, 50, 50, 50],
    years: 0,
    card: deck.pop()!,
    deck,
    deadStat: -1,
    deadHigh: false,
    slide: 1,
    overTimer: 0,
    playTime: 0,
  }
}

export function update(state: ReignsState, dt: number) {
  state.playTime += dt
  state.slide = Math.max(0, state.slide - dt * 3)
  if (state.phase === 'dying') {
    state.overTimer -= dt
    if (state.overTimer <= 0) state.phase = 'over'
  }
}

export type ChooseResult = 'ok' | 'died' | 'none'

// 선택 적용. 죽으면 원인 지표를 기록하고 잠시 사유 배너를 보여준다
export function choose(state: ReignsState, right: boolean): ChooseResult {
  if (state.phase !== 'playing') return 'none'
  const effects = right ? CARDS[state.card].r : CARDS[state.card].l
  // 매년 모든 지표가 조금씩 마모된다 — 오래 버틸수록 유지가 어려워진다
  const decay = 1 + Math.min(2, Math.floor(state.years / 25))
  for (let i = 0; i < STAT_COUNT; i++) {
    state.stats[i] = Math.max(0, Math.min(100, state.stats[i] + effects[i] - decay))
  }
  state.years += 1
  for (let i = 0; i < STAT_COUNT; i++) {
    if (state.stats[i] <= 0 || state.stats[i] >= 100) {
      state.deadStat = i
      state.deadHigh = state.stats[i] >= 100
      state.phase = 'dying'
      state.overTimer = 1.6
      return 'died'
    }
  }
  if (state.deck.length === 0) state.deck = shuffledDeck(state.card)
  state.card = state.deck.pop()!
  state.slide = 1
  return 'ok'
}
