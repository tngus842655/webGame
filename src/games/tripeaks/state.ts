// 트라이픽스 솔리테어 — 배치·딜·규칙 로직

export const CARD_W = 92
export const CARD_H = 128
export const COL_GAP = 70 // 같은 행 카드 중심 사이 가로 간격
export const ROW_GAP = 64 // 행 사이 세로 간격 (카드 절반 겹침)
export const TABLE_TOP = 300 // 1행(봉우리) 카드 중심 y
export const STOCK_POS = { x: 140, y: 1010 } as const
export const WASTE_POS = { x: 400, y: 1010 } as const

// 표준 트라이픽스 배치 28장: [행, 열] — 열은 맨 아랫행 기준 반 칸 단위
const LAYOUT: Array<[number, number]> = [
  [0, 1.5], [0, 4.5], [0, 7.5],
  [1, 1], [1, 2], [1, 4], [1, 5], [1, 7], [1, 8],
  [2, 0.5], [2, 1.5], [2, 2.5], [2, 3.5], [2, 4.5], [2, 5.5], [2, 6.5], [2, 7.5], [2, 8.5],
  [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9],
]

export interface PlayingCard {
  rank: number // 0=A .. 12=K
  suit: number // 0=♠ 1=♥ 2=♦ 3=♣
}

export interface TableCard extends PlayingCard {
  row: number
  col: number
  faceUp: boolean
  removed: boolean
}

export function cardX(col: number): number {
  return 360 + (col - 4.5) * COL_GAP
}

export function cardY(row: number): number {
  return TABLE_TOP + row * ROW_GAP
}

// 스테이지가 올라도 배치·스톡이 똑같아 진행감이 없었다. 뒤집을 수 있는 카드를
// 줄여 조금씩 조인다 (스톡을 다 쓰고 낼 카드가 없으면 판이 끝난다).
export function stockFor(stage: number): number {
  return Math.max(15, 23 - (stage - 1))
}

// 52장 셔플 → 테이블 28장 + 웨이스트 1장 + 스톡(스테이지에 따라 23~15장)
function createDeal(stage: number): { table: TableCard[]; waste: PlayingCard[]; stock: PlayingCard[] } {
  const deck: PlayingCard[] = []
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) deck.push({ rank, suit })
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = deck[i]
    deck[i] = deck[j]
    deck[j] = tmp
  }
  const table = LAYOUT.map(([row, col], i) => ({
    ...deck[i],
    row,
    col,
    faceUp: row === 3,
    removed: false,
  }))
  return { table, waste: [deck[28]], stock: deck.slice(29, 29 + stockFor(stage)) }
}

// 아랫행에서 반 칸 걸쳐 덮는 카드가 모두 제거됐는지
function isUncovered(card: TableCard, table: TableCard[]): boolean {
  return !table.some(
    (other) =>
      !other.removed && other.row === card.row + 1 && Math.abs(other.col - card.col) === 0.5,
  )
}

// 덮개가 사라진 뒷면 카드를 앞면으로 (앞면 = 덮이지 않음 불변식 유지)
export function flipUncovered(table: TableCard[]) {
  for (const card of table) {
    if (!card.removed && !card.faceUp && isUncovered(card, table)) card.faceUp = true
  }
}

// 랭크 ±1 판정 (K↔A 순환)
export function canPlay(rank: number, wasteRank: number): boolean {
  const diff = Math.abs(rank - wasteRank)
  return diff === 1 || diff === 12
}

export function hasMoves(table: TableCard[], wasteRank: number): boolean {
  return table.some((card) => !card.removed && card.faceUp && canPlay(card.rank, wasteRank))
}

export type Phase = 'playing' | 'over'

export interface TripeaksState {
  phase: Phase
  stage: number
  score: number
  streak: number // 연속 제거 수 (스톡 드로우 시 0으로)
  moveCount: number // 첫 조작 힌트 표시용
  clearTimer: number // 보드 클리어 연출 후 다음 스테이지로
  playTime: number // 힌트·스트릭 애니메이션용
  table: TableCard[]
  waste: PlayingCard[]
  stock: PlayingCard[]
}

export function createState(): TripeaksState {
  return {
    phase: 'playing',
    stage: 1,
    score: 0,
    streak: 0,
    moveCount: 0,
    clearTimer: 0,
    playTime: 0,
    ...createDeal(1),
  }
}

// 다음 스테이지: 점수는 유지한 채 새 딜
export function loadStage(state: TripeaksState) {
  const deal = createDeal(state.stage)
  state.table = deal.table
  state.waste = deal.waste
  state.stock = deal.stock
  state.streak = 0
}
