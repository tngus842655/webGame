// 뱀서라이크 라이트 — 터치한 자리로 이동, 자동 공격, 3택 레벨업, 생존

// 아래를 1148에서 끊는다 — 그 밑은 아이템 칸 자리다. 판 안에 칸을 얹으면
// 이동하려고 누른 손가락이 아껴 둔 폭탄을 터뜨린다
export const ARENA = { left: 30, right: 690, top: 150, bottom: 1148 } as const
export const PLAYER_R = 26
export const ENEMY_CAP = 60
export const BULLET_SPEED = 750
export const ORB_ATTRACT_DIST = 170

// 목표점에 이만큼 붙으면 도착으로 보고 멈춘다 (도착점에서 좌우로 떠는 것을 막는다)
export const ARRIVE_R = 6

// 갈래가 더 늘면 화면이 총알로 덮여 적이 안 보인다
export const SHOTS_CAP = 6
export const FIRE_INTERVAL_MIN = 0.16

// 적이 코앞에서 솟으면 피할 방법이 없다 — 이만큼 떨어진 가장자리에만 세운다
const SPAWN_SAFE_DIST = 300

// 난이도 곡선 — 한 판을 10분으로 잡고 맞춘 값들이다.
// 셋이 서로 상쇄되므로 하나만 만지지 말고 tools/survivor-sim.mjs 로 함께 확인할 것.
//
// 격자 탐색으로 알게 된 것: 생존 시간을 쥐고 있는 것은 체력 곡선이다.
// 갈래(최대 6)와 연사(최소 0.16초)에 상한이 있어 초당 발사 수는 37.5발에서 멈추는데,
// 스폰은 10분에도 초당 15마리라 그 아래에 한참 못 미친다. 그래서 스폰을 두 배로 올려도
// 생존 시간이 1분도 안 움직인다 — 압박은 결국 '한 마리에 몇 발이 드는가'에서 나온다.
export function spawnInterval(time: number): number {
  return 1 / (0.7 + time * 0.024) // 처음 초당 0.7마리 → 10분에 15.1마리
}
// 처음 2분은 완만하게 두고(강해지는 맛을 보는 구간) 뒤에서 가팔라진다
export function enemyHp(time: number): number {
  return 1 + Math.floor((time / 60) ** 1.5) // 2분에 4, 5분에 12, 10분에 32
}
export function enemySpeed(time: number): number {
  return Math.min(235, 80 + time * 0.26) // 플레이어 기본 275보다는 늘 느리다
}

// 다음 레벨까지 필요한 경험치. 처음 몇 판은 금방 오르고 뒤로 갈수록 뜸해진다 —
// 처치 수가 시간에 비례해 늘기 때문에, 여기서 조여 주지 않으면 강화가 위협을 앞질러
// 10분쯤에는 아무것도 위험하지 않게 된다 (실제로 그랬다).
export function xpForLevel(level: number): number {
  return 4 + level * level
}

// ── 아이템 ─────────────────────────────────────────────────
// 판 건너편에 떨어진다. 자동 공격만 도는 게임에 "지금 저기까지 갈까"라는
// 판단을 하나 넣는 장치라, 가만히 있어도 주워지는 자리에는 두지 않는다.
//
// 주우면 칸에 담기고 쓰는 것은 사용자가 정한다. 밟자마자 터지면 폭탄을 아껴 둘
// 수가 없어서, 정작 둘러싸였을 때 쓸 것이 남아 있지 않았다.
export type ItemKind = 'heal' | 'bomb' | 'rapid'

// 칸 수. 늘리면 아껴 두기가 쉬워져 위기 자체가 사라진다
export const SLOT_COUNT = 2

export interface Item {
  x: number
  y: number
  kind: ItemKind
  life: number
}

const ITEM_INTERVAL = 26
const ITEM_LIFE = 13 // 마지막 3초는 깜빡인다 (index.ts)
const ITEM_MIN_DIST = 240
export const ITEM_R = 22
export const RAPID_TIME = 8
const RAPID_MULT = 0.45

export type Phase = 'playing' | 'levelup' | 'over'

export interface Enemy {
  x: number
  y: number
  r: number
  hp: number
  speed: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  // 남은 위력. 적을 눕히고 남으면 그만큼 뒤로 뚫고 나간다
  power: number
}

export interface Orb {
  x: number
  y: number
}

import type { TranslationKey } from '@/shared/i18n'

export interface UpgradeOption {
  key: 'damage' | 'shots' | 'firerate' | 'speed' | 'maxhp'
  label: TranslationKey
  desc: TranslationKey
}

export const UPGRADE_POOL: UpgradeOption[] = [
  { key: 'damage', label: 'sv.dmg', desc: 'sv.dmgDesc' },
  { key: 'shots', label: 'sv.shots', desc: 'sv.shotsDesc' },
  { key: 'firerate', label: 'sv.rate', desc: 'sv.rateDesc' },
  { key: 'speed', label: 'sv.spd', desc: 'sv.spdDesc' },
  { key: 'maxhp', label: 'sv.hp', desc: 'sv.hpDesc' },
]

export interface SurvivorState {
  phase: Phase
  time: number
  // 난이도 시계. 보통 time과 함께 흐르지만 광고 이어하기 때만 뒤로 감는다.
  // 죽은 지점의 난이도 그대로 되살리면 그 지점은 이미 처치 능력이 필요량의 60%대라
  // 체력을 채워 주든 둘레를 치워 주든 10초를 못 넘긴다 (실측 중앙값 11초).
  // 화면의 시계와 점수는 time 그대로라 뒤로 가지 않는다.
  threatTime: number
  kills: number
  player: {
    x: number
    y: number
    hp: number
    maxHp: number
    speed: number
    damage: number
    shots: number
    fireInterval: number
    fireTimer: number
    invuln: number
  }
  level: number
  xp: number
  xpNeed: number
  enemies: Enemy[]
  bullets: Bullet[]
  orbs: Orb[]
  items: Item[]
  // 주워 둔 아이템. 빈 칸은 null이라 자리가 고정된다 (앞으로 당기면 누르려던 칸이 바뀐다)
  slots: (ItemKind | null)[]
  spawnTimer: number
  itemTimer: number
  // 연사 부스트 남은 시간
  rapid: number
  taken: Record<UpgradeOption['key'], number> // 지금까지 고른 업그레이드 횟수
  choices: UpgradeOption[]
  // 눌러 둔 자리. 도착하면 지워진다
  move: { x: number; y: number } | null
}

export function scoreOf(state: SurvivorState): number {
  return state.kills * 10 + Math.floor(state.time)
}

export function createState(): SurvivorState {
  return {
    phase: 'playing',
    time: 0,
    threatTime: 0,
    kills: 0,
    player: {
      x: 360,
      y: 700,
      hp: 5,
      maxHp: 5,
      speed: 275,
      damage: 1,
      shots: 1,
      fireInterval: 0.6,
      fireTimer: 0,
      invuln: 0,
    },
    level: 1,
    xp: 0,
    xpNeed: 5,
    enemies: [],
    bullets: [],
    orbs: [],
    items: [],
    slots: Array(SLOT_COUNT).fill(null),
    spawnTimer: 1,
    itemTimer: 18,
    rapid: 0,
    taken: { damage: 0, shots: 0, firerate: 0, speed: 0, maxhp: 0 },
    choices: [],
    move: null,
  }
}

// 판 안으로 접어 넣는다 — 벽 너머를 누르면 벽에 붙은 채 도착을 못 해 계속 밀고 있게 된다
export function setMoveTarget(state: SurvivorState, x: number, y: number) {
  state.move = {
    x: Math.min(ARENA.right - PLAYER_R, Math.max(ARENA.left + PLAYER_R, x)),
    y: Math.min(ARENA.bottom - PLAYER_R, Math.max(ARENA.top + PLAYER_R, y)),
  }
}

// 더 올릴 데가 없는 강화는 선택지에 넣지 않는다 (셋 중 하나가 빈 칸이 되면 안 고른 것만 못하다)
function isMaxed(state: SurvivorState, key: UpgradeOption['key']): boolean {
  if (key === 'shots') return state.player.shots >= SHOTS_CAP
  if (key === 'firerate') return state.player.fireInterval <= FIRE_INTERVAL_MIN + 1e-6
  return false
}

export function rollChoices(state: SurvivorState): UpgradeOption[] {
  const pool = UPGRADE_POOL.filter((option) => !isMaxed(state, option.key))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export function applyUpgrade(state: SurvivorState, option: UpgradeOption) {
  const p = state.player
  state.taken[option.key] += 1
  switch (option.key) {
    case 'damage':
      p.damage += 1
      break
    case 'shots':
      p.shots = Math.min(SHOTS_CAP, p.shots + 1)
      break
    case 'firerate':
      p.fireInterval = Math.max(FIRE_INTERVAL_MIN, p.fireInterval * 0.82)
      break
    case 'speed':
      p.speed *= 1.1
      break
    case 'maxhp':
      p.maxHp += 1
      p.hp = Math.min(p.maxHp, p.hp + 1)
      break
  }
}

function edgePoint(): { x: number; y: number } {
  const side = Math.floor(Math.random() * 4)
  if (side === 0) return { x: ARENA.left + Math.random() * (ARENA.right - ARENA.left), y: ARENA.top - 30 }
  if (side === 1) return { x: ARENA.left + Math.random() * (ARENA.right - ARENA.left), y: ARENA.bottom + 30 }
  if (side === 2) return { x: ARENA.left - 30, y: ARENA.top + Math.random() * (ARENA.bottom - ARENA.top) }
  return { x: ARENA.right + 30, y: ARENA.top + Math.random() * (ARENA.bottom - ARENA.top) }
}

function arenaPoint(): { x: number; y: number } {
  return {
    x: ARENA.left + 44 + Math.random() * (ARENA.right - ARENA.left - 88),
    y: ARENA.top + 44 + Math.random() * (ARENA.bottom - ARENA.top - 88),
  }
}

// 플레이어에게서 minDist 밖의 자리를 고른다. 몇 번 찍어 보고 가장 먼 곳을 쓴다 —
// 구석에 몰려 있으면 조건을 만족하는 자리가 아예 없을 수 있어 최선으로 물러선다
function pickAwayFrom(
  from: { x: number; y: number },
  minDist: number,
  gen: () => { x: number; y: number },
): { x: number; y: number } {
  let best = gen()
  let bestDist = Math.hypot(best.x - from.x, best.y - from.y)
  for (let i = 0; i < 5 && bestDist < minDist; i++) {
    const next = gen()
    const dist = Math.hypot(next.x - from.x, next.y - from.y)
    if (dist > bestDist) {
      best = next
      bestDist = dist
    }
  }
  return best
}

function spawnEnemy(state: SurvivorState) {
  if (state.enemies.length >= ENEMY_CAP) return
  const spot = pickAwayFrom(state.player, SPAWN_SAFE_DIST, edgePoint)
  state.enemies.push({
    x: spot.x,
    y: spot.y,
    r: 24,
    hp: enemyHp(state.threatTime),
    speed: enemySpeed(state.threatTime),
  })
}

// 체력이 가득이어도 회복은 나온다 — 칸에 넣어 뒀다 나중에 쓰면 되기 때문이다
const ITEM_KINDS: ItemKind[] = ['heal', 'bomb', 'rapid']

function spawnItem(state: SurvivorState) {
  const spot = pickAwayFrom(state.player, ITEM_MIN_DIST, arenaPoint)
  state.items.push({
    x: spot.x,
    y: spot.y,
    kind: ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)],
    life: ITEM_LIFE,
  })
}

// 광고를 보고 이어할 때 되감는 난이도. 죽는 지점(10분 언저리)에서 120초를 빼면
// 적 체력이 32 → 22로 내려가 처치 능력이 다시 스폰을 앞선다 — 그래야 이어하기가
// 몇 초가 아니라 몇 분을 벌어 준다.
const REVIVE_ROLLBACK = 120

// 광고 보상 이어하기. 체력을 채우는 것만으로는 부족해서 위협 자체를 물린다
export function reviveAfterAd(state: SurvivorState) {
  state.player.hp = state.player.maxHp
  state.player.invuln = 3
  state.threatTime = Math.max(0, state.threatTime - REVIVE_ROLLBACK)
  // 판을 통째로 비운다. 멀리 있는 것만 남겨 둬도 곧바로 다시 몰려든다
  state.enemies = []
  state.bullets = []
  // 되살아나자마자 코앞에 서지 않도록 한 박자 쉰다
  state.spawnTimer = 1.5
  state.move = null
  state.phase = 'playing'
}

// 칸에 든 아이템을 쓴다. 쓴 종류를 돌려준다 (빈 칸이면 null)
export function useSlot(state: SurvivorState, index: number): ItemKind | null {
  if (state.phase !== 'playing') return null
  const kind = state.slots[index]
  if (kind === null || kind === undefined) return null
  state.slots[index] = null
  const p = state.player
  if (kind === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + 1)
  } else if (kind === 'rapid') {
    state.rapid = RAPID_TIME
  } else {
    // 폭탄 — 판 위의 적을 모두 쓸어낸다. 언제 터뜨릴지가 이 아이템의 전부다
    for (const enemy of state.enemies) {
      state.orbs.push({ x: enemy.x, y: enemy.y })
      state.kills += 1
    }
    state.enemies = []
  }
  return kind
}

// 가까운 적부터 한 갈래씩 맡긴다. 갈래가 적보다 많으면 남는 갈래를 좌우로 벌려 쏜다
function fire(state: SurvivorState) {
  const p = state.player
  const targets = [...state.enemies]
    .sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2))
    .slice(0, p.shots)
  for (let i = 0; i < p.shots; i++) {
    const target = targets[i % targets.length]
    const lap = Math.floor(i / targets.length)
    const fan = lap === 0 ? 0 : lap * 0.15 * (i % 2 === 0 ? 1 : -1)
    const angle = Math.atan2(target.y - p.y, target.x - p.x) + fan
    state.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      power: p.damage,
    })
  }
}

export interface UpdateResult {
  died: boolean
  leveledUp: boolean
  killed: number
  hurt: boolean
  picked: ItemKind | null
}

export function update(state: SurvivorState, dt: number): UpdateResult {
  const result: UpdateResult = { died: false, leveledUp: false, killed: 0, hurt: false, picked: null }
  const p = state.player
  state.time += dt
  state.threatTime += dt
  p.invuln = Math.max(0, p.invuln - dt)
  state.rapid = Math.max(0, state.rapid - dt)

  // 이동 — 눌러 둔 자리로 걸어간다. 손을 떼도 그 자리까지는 간다
  if (state.move) {
    const dx = state.move.x - p.x
    const dy = state.move.y - p.y
    const dist = Math.hypot(dx, dy)
    if (dist <= ARRIVE_R) {
      state.move = null
    } else {
      const step = Math.min(dist, p.speed * dt)
      p.x += (dx / dist) * step
      p.y += (dy / dist) * step
    }
  }

  // 적 스폰
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = spawnInterval(state.threatTime)
    spawnEnemy(state)
  }

  // 아이템 — 떨어뜨리고, 수명이 다하면 거둔다
  state.itemTimer -= dt
  if (state.itemTimer <= 0) {
    state.itemTimer = ITEM_INTERVAL
    spawnItem(state)
  }
  state.items = state.items.filter((item) => {
    item.life -= dt
    if (item.life <= 0) return false
    if (Math.hypot(p.x - item.x, p.y - item.y) > PLAYER_R + ITEM_R) return true
    // 칸이 다 찼으면 줍지 않는다 — 밟고 지나가도 그 자리에 남는다
    const free = state.slots.indexOf(null)
    if (free < 0) return true
    state.slots[free] = item.kind
    result.picked = item.kind
    return false
  })

  // 적 추적 + 접촉 데미지
  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x
    const dy = p.y - enemy.y
    const dist = Math.hypot(dx, dy) || 1
    enemy.x += (dx / dist) * enemy.speed * dt
    enemy.y += (dy / dist) * enemy.speed * dt
    if (p.invuln <= 0 && dist < enemy.r + PLAYER_R - 4) {
      p.hp -= 1
      p.invuln = 1
      result.hurt = true
      if (p.hp <= 0) {
        state.phase = 'over'
        result.died = true
        return result
      }
    }
  }

  // 자동 발사
  p.fireTimer -= dt
  if (p.fireTimer <= 0 && state.enemies.length > 0) {
    p.fireTimer = state.rapid > 0 ? p.fireInterval * RAPID_MULT : p.fireInterval
    fire(state)
  }

  // 총알 이동·명중
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
  }
  // 눕히고 남은 위력은 뒤로 뚫고 나간다. 넘치는 데미지를 버리면 공격력 강화가
  // 적 체력을 넘어서는 순간부터 아무 일도 하지 않아, 고르면 손해인 선택지가 된다
  state.bullets = state.bullets.filter((bullet) => {
    // 판 밖 40px까지만 쫓아간다 (적이 서는 가장자리는 30px 밖이다).
    // 아래만 20px인 것은 그 밑이 아이템 칸 자리라서다 — 가장자리에 막 선 적은
    // 반지름이 24라 이 안에서 맞는다
    if (
      bullet.x < ARENA.left - 40 ||
      bullet.x > ARENA.right + 40 ||
      bullet.y < ARENA.top - 40 ||
      bullet.y > ARENA.bottom + 20
    ) {
      return false
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i]
      const dx = bullet.x - enemy.x
      const dy = bullet.y - enemy.y
      if (dx * dx + dy * dy >= enemy.r * enemy.r) continue
      // 못 뚫으면 여기서 멈춘다 (살아남은 적을 다음 프레임에 또 때리는 일이 없다)
      if (enemy.hp > bullet.power) {
        enemy.hp -= bullet.power
        return false
      }
      bullet.power -= enemy.hp
      state.orbs.push({ x: enemy.x, y: enemy.y })
      state.enemies.splice(i, 1)
      i -= 1
      state.kills += 1
      result.killed += 1
      if (bullet.power <= 0) return false
    }
    return true
  })

  // 경험치 오브 흡수.
  // 레벨이 오르면 그 프레임의 나머지 오브는 손대지 않고 남긴다 — 한 프레임에 두 번
  // 오르면 나중 것이 choices를 덮어써 레벨 둘에 강화 하나만 받게 된다.
  // 폭탄이 한 번에 서른 마리를 눕히면서 오브가 뭉쳐 들어오므로 실제로 일어난다.
  state.orbs = state.orbs.filter((orb) => {
    if (state.phase !== 'playing') return true
    const dx = p.x - orb.x
    const dy = p.y - orb.y
    const dist = Math.hypot(dx, dy)
    if (dist < ORB_ATTRACT_DIST) {
      orb.x += (dx / (dist || 1)) * 500 * dt
      orb.y += (dy / (dist || 1)) * 500 * dt
    }
    if (dist < PLAYER_R + 10) {
      state.xp += 1
      if (state.xp >= state.xpNeed) {
        state.xp = 0
        state.level += 1
        state.xpNeed = xpForLevel(state.level)
        state.choices = rollChoices(state)
        state.phase = 'levelup'
        result.leveledUp = true
      }
      return false
    }
    return true
  })

  return result
}
