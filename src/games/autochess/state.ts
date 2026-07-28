// 오토 배틀 — 상점에서 유닛을 사고 같은 유닛끼리 합성해 강화한 뒤,
// 라운드마다 자동 전투를 관전한다. 패배하면 남은 적 수만큼 체력을 잃는다.

export type Phase = 'prep' | 'battle' | 'result' | 'over'

// 종족: 전사·궁수·방패병·마법사
export const SPECIES = [
  { hp: 55, atk: 8, spd: 1.0 },
  { hp: 30, atk: 12, spd: 1.2 },
  { hp: 90, atk: 5, spd: 0.8 },
  { hp: 35, atk: 16, spd: 0.7 },
] as const

export const UNIT_COST = 3
export const MAX_LEVEL = 3
export const BOARD_SLOTS = 6
const BATTLE_TIMEOUT = 20

export interface Unit {
  species: number
  level: number
  hp: number
  maxHp: number
  atk: number
  spd: number
  cd: number
}

export function makeUnit(species: number, level: number, scale = 1): Unit {
  const base = SPECIES[species]
  const mult = 2.2 ** (level - 1) * scale
  const hp = Math.round(base.hp * mult)
  return { species, level, hp, maxHp: hp, atk: Math.round(base.atk * mult), spd: base.spd, cd: 0 }
}

export interface ACState {
  phase: Phase
  round: number
  score: number
  hp: number
  gold: number
  board: Array<Unit | null> // 배치 유닛 (레벨·종족만 의미, hp는 전투 시 리셋)
  shop: number[] // 종족 인덱스, -1 = 판매됨
  mine: Unit[] // 전투 중인 내 유닛 사본
  foes: Unit[]
  battleTime: number
  won: boolean // 직전 전투 결과 (result 배너용)
  lostLives: number
  resultTimer: number
  overTimer: number
  playTime: number
}

function rollShop(): number[] {
  return [0, 1, 2].map(() => Math.floor(Math.random() * SPECIES.length))
}

export function createState(): ACState {
  return {
    phase: 'prep',
    round: 1,
    score: 0,
    hp: 10,
    gold: 10,
    board: new Array<Unit | null>(BOARD_SLOTS).fill(null),
    shop: rollShop(),
    mine: [],
    foes: makeFoes(1),
    battleTime: 0,
    won: false,
    lostLives: 0,
    resultTimer: 0,
    overTimer: 0,
    playTime: 0,
  }
}

export function buy(state: ACState, shopIndex: number): boolean {
  if (state.phase !== 'prep') return false
  const species = state.shop[shopIndex]
  if (species < 0 || state.gold < UNIT_COST) return false
  const empty = state.board.indexOf(null)
  if (empty < 0) return false
  state.gold -= UNIT_COST
  state.shop[shopIndex] = -1
  state.board[empty] = makeUnit(species, 1)
  return true
}

export type DropResult = 'merged' | 'moved' | 'swapped' | 'none'

// 같은 종족·레벨이면 합성, 빈 칸이면 이동, 아니면 교체
export function dropUnit(state: ACState, from: number, to: number): DropResult {
  if (state.phase !== 'prep') return 'none'
  const a = state.board[from]
  if (!a || from === to) return 'none'
  const b = state.board[to]
  if (!b) {
    state.board[to] = a
    state.board[from] = null
    return 'moved'
  }
  if (b.species === a.species && b.level === a.level && a.level < MAX_LEVEL) {
    state.board[to] = makeUnit(a.species, a.level + 1)
    state.board[from] = null
    return 'merged'
  }
  state.board[to] = a
  state.board[from] = b
  return 'swapped'
}

// 라운드 n 적 부대: 수·레벨·스탯이 점진 상승.
// 준비 단계에서 미리 보여 줘야 하므로 라운드가 시작될 때 뽑아 둔다
export function makeFoes(round: number): Unit[] {
  const count = Math.min(BOARD_SLOTS, 2 + Math.floor((round - 1) / 2))
  const level = 1 + Math.floor(round / 5)
  const scale = 1.12 ** (round - 1) / 2.2 ** (level - 1) // 레벨 반영분 제외한 미세 성장
  return Array.from({ length: count }, () =>
    makeUnit(Math.floor(Math.random() * SPECIES.length), Math.min(MAX_LEVEL, level), scale),
  )
}

export function startBattle(state: ACState): boolean {
  if (state.phase !== 'prep') return false
  const mine = state.board.filter((u) => u !== null).map((u) => makeUnit(u.species, u.level))
  if (mine.length === 0) return false
  state.mine = mine
  state.battleTime = 0
  state.phase = 'battle'
  return true
}

// 누가 누구를 얼마나 때렸는지 — 때린 쪽 모션과 날아가는 탄, 피해 숫자에 다 쓰인다
export interface BattleHit {
  mine: boolean // 맞은 쪽이 내 유닛인가
  index: number // 맞은 유닛 자리
  from: number // 때린 유닛 자리 (반대 진영)
  damage: number
  died: boolean
}

export interface BattleEvents {
  hits: BattleHit[]
  ended: boolean
}

export function battleTick(state: ACState, dt: number): BattleEvents {
  const events: BattleEvents = { hits: [], ended: false }
  if (state.phase !== 'battle') return events
  state.battleTime += dt

  const act = (attackers: Unit[], defenders: Unit[], attackerIsMine: boolean) => {
    for (let i = 0; i < attackers.length; i++) {
      const unit = attackers[i]
      if (unit.hp <= 0) continue
      unit.cd -= dt
      if (unit.cd > 0) continue
      const alive = defenders.filter((d) => d.hp > 0)
      if (alive.length === 0) return
      const target = alive[Math.floor(Math.random() * alive.length)]
      target.hp -= unit.atk
      unit.cd = 1 / unit.spd
      events.hits.push({
        mine: !attackerIsMine,
        index: defenders.indexOf(target),
        from: i,
        damage: unit.atk,
        died: target.hp <= 0,
      })
    }
  }
  act(state.mine, state.foes, true)
  act(state.foes, state.mine, false)

  const mineAlive = state.mine.some((u) => u.hp > 0)
  const foesAlive = state.foes.some((u) => u.hp > 0)
  if (mineAlive && foesAlive && state.battleTime < BATTLE_TIMEOUT) return events

  events.ended = true
  state.won = !foesAlive && mineAlive
  if (state.won) {
    state.score = Math.min(1_000_000, state.score + state.round * 30)
    state.lostLives = 0
  } else {
    state.lostLives = Math.max(1, state.foes.filter((u) => u.hp > 0).length)
    state.hp -= state.lostLives
  }
  state.phase = 'result'
  state.resultTimer = 1.6
  return events
}

// 결과 배너 뒤 다음 라운드 준비. 체력이 없으면 게임 오버(true 반환)
export function nextRound(state: ACState): boolean {
  if (state.hp <= 0) {
    state.hp = 0
    state.phase = 'over'
    state.overTimer = 0.6
    return true
  }
  state.round += 1
  // 수입: 기본 5 + 이자(골드 10당 1, 최대 5)
  state.gold += 5 + Math.min(5, Math.floor(state.gold / 10))
  state.shop = rollShop()
  state.foes = makeFoes(state.round)
  state.phase = 'prep'
  return false
}
