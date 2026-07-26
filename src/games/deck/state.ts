// 카드 배틀 — 간소화한 덱빌딩 로그라이크. 에너지 3으로 카드를 내 적을 잡고,
// 승리마다 보상 카드 1장을 골라 덱을 키운다. 적은 스테이지마다 강해진다.

export type CardId = 'strike' | 'defend' | 'bash' | 'flurry' | 'wall' | 'drain' | 'focus' | 'nova'
export type Phase = 'player' | 'enemy' | 'reward' | 'over'

export interface CardDef {
  cost: number
  dmg?: number
  hits?: number
  block?: number
  heal?: number
  draw?: number
}

export const CARD_DEFS: Record<CardId, CardDef> = {
  strike: { cost: 1, dmg: 6 },
  defend: { cost: 1, block: 5 },
  bash: { cost: 2, dmg: 12 },
  flurry: { cost: 1, dmg: 3, hits: 2 },
  wall: { cost: 2, block: 11 },
  drain: { cost: 2, dmg: 8, heal: 3 },
  focus: { cost: 1, draw: 2 },
  nova: { cost: 3, dmg: 20 },
}

const REWARD_POOL: CardId[] = ['bash', 'flurry', 'wall', 'drain', 'focus', 'nova']
const HAND_SIZE = 5
const MAX_ENERGY = 3

export interface Enemy {
  hp: number
  maxHp: number
  boss: boolean
  turn: number // 의도 패턴 인덱스
}

export interface DeckState {
  phase: Phase
  stage: number
  score: number
  hp: number
  maxHp: number
  block: number
  energy: number
  allCards: CardId[] // 소유한 전체 덱
  draw: CardId[]
  discard: CardId[]
  hand: CardId[]
  enemy: Enemy
  rewards: CardId[]
  enemyTimer: number // 적 턴 연출
  overTimer: number
  playTime: number
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 적 의도: [공격, 공격, 강공] 반복
export function intentDamage(state: DeckState): number {
  const base = 4 + Math.round(state.stage * 1.2) + (state.enemy.boss ? Math.ceil(state.stage * 0.4) : 0)
  return state.enemy.turn % 3 === 2 ? Math.round(base * 1.7) : base
}

function drawCards(state: DeckState, n: number) {
  for (let k = 0; k < n; k++) {
    if (state.draw.length === 0) {
      if (state.discard.length === 0) return
      state.draw = shuffle(state.discard)
      state.discard = []
    }
    state.hand.push(state.draw.pop()!)
  }
}

export function startBattle(state: DeckState) {
  const boss = state.stage % 5 === 0
  const hp = Math.round((22 + state.stage * 6) * (boss ? 1.5 : 1))
  state.enemy = { hp, maxHp: hp, boss, turn: 0 }
  state.draw = shuffle(state.allCards)
  state.discard = []
  state.hand = []
  state.block = 0
  state.energy = MAX_ENERGY
  drawCards(state, HAND_SIZE)
  state.phase = 'player'
}

export function createState(): DeckState {
  const state: DeckState = {
    phase: 'player',
    stage: 1,
    score: 0,
    hp: 70,
    maxHp: 70,
    block: 0,
    energy: MAX_ENERGY,
    allCards: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend', 'focus',
    ],
    draw: [],
    discard: [],
    hand: [],
    enemy: { hp: 1, maxHp: 1, boss: false, turn: 0 },
    rewards: [],
    enemyTimer: 0,
    overTimer: 0,
    playTime: 0,
  }
  startBattle(state)
  return state
}

export type PlayResult = 'played' | 'killed' | 'none'

export function playCard(state: DeckState, handIndex: number): PlayResult {
  if (state.phase !== 'player' || handIndex < 0 || handIndex >= state.hand.length) return 'none'
  const id = state.hand[handIndex]
  const def = CARD_DEFS[id]
  if (state.energy < def.cost) return 'none'
  state.energy -= def.cost
  state.hand.splice(handIndex, 1)
  state.discard.push(id)
  if (def.dmg) {
    state.enemy.hp -= def.dmg * (def.hits ?? 1)
  }
  if (def.block) state.block += def.block
  if (def.heal) state.hp = Math.min(state.maxHp, state.hp + def.heal)
  if (def.draw) drawCards(state, def.draw)

  if (state.enemy.hp <= 0) {
    state.enemy.hp = 0
    state.score = Math.min(1_000_000, state.score + 100 + state.stage * 20)
    state.hp = Math.min(state.maxHp, state.hp + 12) // 승리 회복
    state.rewards = shuffle(REWARD_POOL).slice(0, 3)
    state.phase = 'reward'
    return 'killed'
  }
  return 'played'
}

export function endTurn(state: DeckState) {
  if (state.phase !== 'player') return
  state.discard.push(...state.hand)
  state.hand = []
  state.phase = 'enemy'
  state.enemyTimer = 0.9
}

export type EnemyResult = 'attacked' | 'playerDied'

// 적 행동 실행 후 다음 플레이어 턴 준비
export function resolveEnemyTurn(state: DeckState): EnemyResult {
  const damage = Math.max(0, intentDamage(state) - state.block)
  state.hp -= damage
  state.enemy.turn += 1
  if (state.hp <= 0) {
    state.hp = 0
    state.phase = 'over'
    state.overTimer = 0.9
    return 'playerDied'
  }
  state.block = 0
  state.energy = MAX_ENERGY
  drawCards(state, HAND_SIZE)
  state.phase = 'player'
  return 'attacked'
}

// 보상 선택 (null = 건너뛰기) 후 다음 스테이지.
// 새 카드는 기본 카드(타격/수비 중 많은 쪽)와 교체 — 덱이 계속 정예화된다
export function chooseReward(state: DeckState, index: number | null) {
  if (state.phase !== 'reward') return
  if (index !== null && state.rewards[index]) {
    const strikes = state.allCards.filter((c) => c === 'strike').length
    const defends = state.allCards.filter((c) => c === 'defend').length
    const basic: CardId | null = strikes > 0 || defends > 0 ? (strikes >= defends ? 'strike' : 'defend') : null
    if (basic) state.allCards.splice(state.allCards.indexOf(basic), 1)
    state.allCards.push(state.rewards[index])
  }
  state.stage += 1
  startBattle(state)
}
