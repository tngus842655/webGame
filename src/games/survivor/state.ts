// 뱀서라이크 라이트 — 조이스틱 이동, 자동 공격, 3택 레벨업, 생존

export const ARENA = { left: 30, right: 690, top: 150, bottom: 1250 } as const
export const PLAYER_R = 26
export const ENEMY_CAP = 60
export const BULLET_SPEED = 750
export const ORB_ATTRACT_DIST = 130

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
}

export interface Orb {
  x: number
  y: number
}

import type { TranslationKey } from '@/shared/i18n'

export interface UpgradeOption {
  key: 'damage' | 'firerate' | 'speed' | 'maxhp'
  label: TranslationKey
  desc: TranslationKey
}

export const UPGRADE_POOL: UpgradeOption[] = [
  { key: 'damage', label: 'sv.dmg', desc: 'sv.dmgDesc' },
  { key: 'firerate', label: 'sv.rate', desc: 'sv.rateDesc' },
  { key: 'speed', label: 'sv.spd', desc: 'sv.spdDesc' },
  { key: 'maxhp', label: 'sv.hp', desc: 'sv.hpDesc' },
]

export interface SurvivorState {
  phase: Phase
  time: number
  kills: number
  player: {
    x: number
    y: number
    hp: number
    maxHp: number
    speed: number
    damage: number
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
  spawnTimer: number
  choices: UpgradeOption[]
  joystick: { baseX: number; baseY: number; dx: number; dy: number } | null
}

export function scoreOf(state: SurvivorState): number {
  return state.kills * 10 + Math.floor(state.time)
}

export function createState(): SurvivorState {
  return {
    phase: 'playing',
    time: 0,
    kills: 0,
    player: {
      x: 360,
      y: 700,
      hp: 3,
      maxHp: 3,
      speed: 260,
      damage: 1,
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
    spawnTimer: 1,
    choices: [],
    joystick: null,
  }
}

export function rollChoices(): UpgradeOption[] {
  const pool = [...UPGRADE_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}

export function applyUpgrade(state: SurvivorState, option: UpgradeOption) {
  const p = state.player
  switch (option.key) {
    case 'damage':
      p.damage += 1
      break
    case 'firerate':
      p.fireInterval = Math.max(0.12, p.fireInterval * 0.8)
      break
    case 'speed':
      p.speed *= 1.12
      break
    case 'maxhp':
      p.maxHp += 1
      p.hp = Math.min(p.maxHp, p.hp + 1)
      break
  }
}

function spawnEnemy(state: SurvivorState) {
  if (state.enemies.length >= ENEMY_CAP) return
  const side = Math.floor(Math.random() * 4)
  let x = 360
  let y = 150
  if (side === 0) {
    x = ARENA.left + Math.random() * (ARENA.right - ARENA.left)
    y = ARENA.top - 30
  } else if (side === 1) {
    x = ARENA.left + Math.random() * (ARENA.right - ARENA.left)
    y = ARENA.bottom + 30
  } else if (side === 2) {
    x = ARENA.left - 30
    y = ARENA.top + Math.random() * (ARENA.bottom - ARENA.top)
  } else {
    x = ARENA.right + 30
    y = ARENA.top + Math.random() * (ARENA.bottom - ARENA.top)
  }
  state.enemies.push({
    x,
    y,
    r: 24,
    hp: 1 + Math.floor(state.time / 25),
    speed: Math.min(220, 85 + state.time * 1.6),
  })
}

export interface UpdateResult {
  died: boolean
  leveledUp: boolean
  killed: number
  hurt: boolean
}

export function update(state: SurvivorState, dt: number): UpdateResult {
  const result: UpdateResult = { died: false, leveledUp: false, killed: 0, hurt: false }
  const p = state.player
  state.time += dt
  p.invuln = Math.max(0, p.invuln - dt)

  // 이동
  if (state.joystick) {
    p.x += state.joystick.dx * p.speed * dt
    p.y += state.joystick.dy * p.speed * dt
    p.x = Math.min(ARENA.right - PLAYER_R, Math.max(ARENA.left + PLAYER_R, p.x))
    p.y = Math.min(ARENA.bottom - PLAYER_R, Math.max(ARENA.top + PLAYER_R, p.y))
  }

  // 적 스폰
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = Math.max(0.35, 1.6 - state.time * 0.02)
    spawnEnemy(state)
  }

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

  // 자동 발사 (가장 가까운 적)
  p.fireTimer -= dt
  if (p.fireTimer <= 0 && state.enemies.length > 0) {
    p.fireTimer = p.fireInterval
    let nearest = state.enemies[0]
    let best = Infinity
    for (const enemy of state.enemies) {
      const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2
      if (d < best) {
        best = d
        nearest = enemy
      }
    }
    const dx = nearest.x - p.x
    const dy = nearest.y - p.y
    const len = Math.hypot(dx, dy) || 1
    state.bullets.push({ x: p.x, y: p.y, vx: (dx / len) * BULLET_SPEED, vy: (dy / len) * BULLET_SPEED })
  }

  // 총알 이동·명중
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
  }
  state.bullets = state.bullets.filter((bullet) => {
    if (bullet.x < 0 || bullet.x > 720 || bullet.y < 100 || bullet.y > 1280) return false
    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i]
      const dx = bullet.x - enemy.x
      const dy = bullet.y - enemy.y
      if (dx * dx + dy * dy < enemy.r * enemy.r) {
        enemy.hp -= p.damage
        if (enemy.hp <= 0) {
          state.orbs.push({ x: enemy.x, y: enemy.y })
          state.enemies.splice(i, 1)
          state.kills += 1
          result.killed += 1
        }
        return false
      }
    }
    return true
  })

  // 경험치 오브 흡수
  state.orbs = state.orbs.filter((orb) => {
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
        state.xpNeed = 4 + state.level * 3
        state.choices = rollChoices()
        state.phase = 'levelup'
        result.leveledUp = true
      }
      return false
    }
    return true
  })

  return result
}
