// 캐주얼 타워 디펜스 — 랜덤 소환 + 같은 티어 합성으로 웨이브를 버티는 방어전.
// 경로·슬롯은 고정, 적 체력은 웨이브마다 지수 성장. 생명 0이면 게임 오버.

export type Phase = 'playing' | 'over'
export type EnemyKind = 'normal' | 'fast' | 'tank' | 'boss'

export interface Tower {
  tier: number // 1~7
  cooldown: number
}

export interface Enemy {
  kind: EnemyKind
  hp: number
  maxHp: number
  dist: number // 경로 진행 거리
  speed: number
  gold: number
  leak: number // 통과 시 잃는 생명
  radius: number
}

export interface Bullet {
  x: number
  y: number
  target: Enemy
  damage: number
  tier: number
}

export interface DefenseState {
  phase: Phase
  score: number
  gold: number
  lives: number
  wave: number
  slots: Array<Tower | null>
  enemies: Enemy[]
  bullets: Bullet[]
  summonCost: number
  spawnLeft: number // 이번 웨이브에서 아직 등장할 적 수
  spawnTimer: number
  waveBreak: number // >0이면 웨이브 사이 휴식
  overTimer: number
  playTime: number
}

// 프레임마다 일어난 일 — 호출부(렌더러)가 효과음·진동에 쓴다
export interface TickEvents {
  kills: number
  leaked: boolean
  waveCleared: boolean
  died: boolean
}

// ── 경로·슬롯 (논리 720×1280) ───────────────────────────────

export const WAYPOINTS: Array<[number, number]> = [
  [-50, 280],
  [600, 280],
  [600, 520],
  [120, 520],
  [120, 760],
  [600, 760],
  [600, 1020],
  [770, 1020],
]

const SEG_LEN = WAYPOINTS.slice(1).map(([x, y], i) => {
  const [px, py] = WAYPOINTS[i]
  return Math.hypot(x - px, y - py)
})
export const PATH_LENGTH = SEG_LEN.reduce((a, b) => a + b, 0)

export function pointAt(dist: number): { x: number; y: number } {
  let d = dist
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (d <= SEG_LEN[i]) {
      const [ax, ay] = WAYPOINTS[i]
      const [bx, by] = WAYPOINTS[i + 1]
      const k = SEG_LEN[i] === 0 ? 0 : d / SEG_LEN[i]
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k }
    }
    d -= SEG_LEN[i]
  }
  const [x, y] = WAYPOINTS[WAYPOINTS.length - 1]
  return { x, y }
}

// 타워 슬롯 중심 좌표 — 경로 사이 3줄 × 4칸
export const SLOTS: Array<[number, number]> = []
for (const y of [400, 640, 880]) {
  for (const x of [160, 270, 380, 490]) SLOTS.push([x, y])
}

// ── 밸런스 ──────────────────────────────────────────────────

export const MAX_TIER = 7
export const towerDamage = (tier: number) => 4 * 3 ** (tier - 1)
export const towerRange = (tier: number) => 190 + tier * 12
const FIRE_COOLDOWN = 0.8
const BULLET_SPEED = 820

const waveHp = (wave: number) => Math.round(18 * 1.18 ** (wave - 1))
const waveCount = (wave: number) => 8 + Math.min(wave, 14)
const killGold = (wave: number) => 4 + Math.floor(wave / 3)

function spawnEnemy(state: DefenseState) {
  const wave = state.wave
  const index = waveCount(wave) - state.spawnLeft // 0부터
  const hp = waveHp(wave)
  const speed = 90 + Math.min(60, wave * 2)
  const isBossWave = wave % 5 === 0
  let enemy: Enemy
  if (isBossWave && state.spawnLeft === 1) {
    enemy = {
      kind: 'boss',
      hp: hp * 12,
      maxHp: hp * 12,
      dist: 0,
      speed: 55,
      gold: 40 + wave,
      leak: 3,
      radius: 40,
    }
  } else if (index % 5 === 4) {
    enemy = {
      kind: 'tank',
      hp: Math.round(hp * 2.2),
      maxHp: Math.round(hp * 2.2),
      dist: 0,
      speed: speed * 0.7,
      gold: killGold(wave) + 2,
      leak: 1,
      radius: 26,
    }
  } else if (index % 4 === 3) {
    enemy = {
      kind: 'fast',
      hp: Math.round(hp * 0.7),
      maxHp: Math.round(hp * 0.7),
      dist: 0,
      speed: speed * 1.5,
      gold: killGold(wave),
      leak: 1,
      radius: 18,
    }
  } else {
    enemy = { kind: 'normal', hp, maxHp: hp, dist: 0, speed, gold: killGold(wave), leak: 1, radius: 22 }
  }
  state.enemies.push(enemy)
  state.spawnLeft -= 1
}

// ── 상태 ────────────────────────────────────────────────────

export function createState(): DefenseState {
  return {
    phase: 'playing',
    score: 0,
    gold: 130,
    lives: 10,
    wave: 1,
    slots: new Array<Tower | null>(SLOTS.length).fill(null),
    enemies: [],
    bullets: [],
    summonCost: 60,
    spawnLeft: 0,
    spawnTimer: 0,
    waveBreak: 1.8,
    overTimer: 0,
    playTime: 0,
  }
}

// 랜덤 빈 슬롯에 1티어 타워 소환. 성공 시 소환된 슬롯 인덱스
export function summon(state: DefenseState): number | null {
  if (state.gold < state.summonCost) return null
  const empty = state.slots.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0)
  if (empty.length === 0) return null
  const i = empty[Math.floor(Math.random() * empty.length)]
  state.gold -= state.summonCost
  state.summonCost += 10
  state.slots[i] = { tier: 1, cooldown: 0 }
  return i
}

export type DropResult = 'merged' | 'moved' | 'swapped' | 'none'

// 드래그 놓기: 같은 티어면 합성, 빈 칸이면 이동, 다른 티어면 자리 교체
export function dropTower(state: DefenseState, from: number, to: number): DropResult {
  const a = state.slots[from]
  if (!a || from === to) return 'none'
  const b = state.slots[to]
  if (!b) {
    state.slots[to] = a
    state.slots[from] = null
    return 'moved'
  }
  if (b.tier === a.tier && a.tier < MAX_TIER) {
    state.slots[to] = { tier: a.tier + 1, cooldown: 0 }
    state.slots[from] = null
    return 'merged'
  }
  state.slots[to] = a
  state.slots[from] = b
  return 'swapped'
}

export function update(state: DefenseState, dt: number): TickEvents {
  const events: TickEvents = { kills: 0, leaked: false, waveCleared: false, died: false }
  if (state.phase !== 'playing') return events

  // 웨이브 진행: 휴식 → 순차 등장
  if (state.waveBreak > 0) {
    state.waveBreak -= dt
    if (state.waveBreak <= 0) {
      state.spawnLeft = waveCount(state.wave)
      state.spawnTimer = 0
    }
  } else if (state.spawnLeft > 0) {
    state.spawnTimer -= dt
    if (state.spawnTimer <= 0) {
      spawnEnemy(state)
      state.spawnTimer = 0.8
    }
  }

  // 적 이동·통과
  for (const enemy of state.enemies) enemy.dist += enemy.speed * dt
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].dist >= PATH_LENGTH) {
      state.lives -= state.enemies[i].leak
      state.enemies.splice(i, 1)
      events.leaked = true
    }
  }

  // 타워 발사: 사거리 안에서 가장 멀리 간 적을 노린다
  for (let i = 0; i < state.slots.length; i++) {
    const tower = state.slots[i]
    if (!tower) continue
    tower.cooldown -= dt
    if (tower.cooldown > 0) continue
    const [sx, sy] = SLOTS[i]
    const range = towerRange(tower.tier)
    let target: Enemy | null = null
    for (const enemy of state.enemies) {
      const p = pointAt(enemy.dist)
      if (Math.hypot(p.x - sx, p.y - sy) > range) continue
      if (!target || enemy.dist > target.dist) target = enemy
    }
    if (!target) continue
    state.bullets.push({ x: sx, y: sy, target, damage: towerDamage(tower.tier), tier: tower.tier })
    tower.cooldown = FIRE_COOLDOWN
  }

  // 탄환 추적·명중
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i]
    if (b.target.hp <= 0) {
      state.bullets.splice(i, 1)
      continue
    }
    const p = pointAt(b.target.dist)
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    const step = BULLET_SPEED * dt
    if (d <= step + b.target.radius) {
      b.target.hp -= b.damage
      if (b.target.hp <= 0) {
        state.gold += b.target.gold
        state.score = Math.min(1_000_000, state.score + 5 + state.wave)
        state.enemies.splice(state.enemies.indexOf(b.target), 1)
        events.kills += 1
      }
      state.bullets.splice(i, 1)
      continue
    }
    b.x += ((p.x - b.x) / d) * step
    b.y += ((p.y - b.y) / d) * step
  }

  // 웨이브 클리어
  if (state.waveBreak <= 0 && state.spawnLeft === 0 && state.enemies.length === 0) {
    state.score = Math.min(1_000_000, state.score + state.wave * 50)
    state.wave += 1
    state.waveBreak = 2.5
    events.waveCleared = true
  }

  if (state.lives <= 0) {
    state.lives = 0
    state.phase = 'over'
    state.overTimer = 0.9
    events.died = true
  }
  return events
}
