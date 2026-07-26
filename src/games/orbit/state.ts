// 궤도 슈팅 — 중앙 포탑이 스스로 회전하고, 탭 타이밍만으로 다가오는 적을 쏜다.
// 시간이 지날수록 회전·적 접근이 빨라진다. 적이 코어에 닿으면 생명이 준다.

export type Phase = 'playing' | 'over'

export interface Enemy {
  angle: number
  r: number // 중심까지 거리
  speed: number
  hp: number
  size: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
}

export interface OrbitState {
  phase: Phase
  score: number
  lives: number
  streak: number // 연속 명중 (빗나가면 초기화)
  time: number
  angle: number // 포탑 방향(라디안)
  cooldown: number
  spawnTimer: number
  enemies: Enemy[]
  bullets: Bullet[]
  overTimer: number
  playTime: number
}

export const CENTER_X = 360
export const CENTER_Y = 620
export const CORE_R = 80 // 이 안으로 들어오면 피격
export const SPAWN_R = 470
const BULLET_SPEED = 900
const FIRE_COOLDOWN = 0.15

export const rotSpeed = (t: number) => Math.min(4.0, 2.0 + t * 0.015)
const enemySpeed = (t: number) => Math.min(85, 40 + t * 0.5)
const spawnInterval = (t: number) => Math.max(0.6, 1.5 - t * 0.007)
const armoredChance = (t: number) => Math.min(0.35, t * 0.004)

export function createState(): OrbitState {
  return {
    phase: 'playing',
    score: 0,
    lives: 3,
    streak: 0,
    time: 0,
    angle: -Math.PI / 2,
    cooldown: 0,
    spawnTimer: 1.2,
    enemies: [],
    bullets: [],
    overTimer: 0,
    playTime: 0,
  }
}

export interface TickEvents {
  kills: Array<{ x: number; y: number }> // 격추 위치 (파편 연출용)
  leaked: boolean
  missed: boolean // 탄이 화면 밖으로 (스트릭 초기화)
}

export function update(state: OrbitState, dt: number): TickEvents {
  const events: TickEvents = { kills: [], leaked: false, missed: false }
  if (state.phase !== 'playing') return events
  state.time += dt
  state.angle += rotSpeed(state.time) * dt
  state.cooldown = Math.max(0, state.cooldown - dt)

  // 적 생성
  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    const armored = Math.random() < armoredChance(state.time)
    state.enemies.push({
      angle: Math.random() * Math.PI * 2,
      r: SPAWN_R,
      speed: enemySpeed(state.time) * (armored ? 0.8 : 1),
      hp: armored ? 2 : 1,
      size: armored ? 30 : 24,
    })
    state.spawnTimer = spawnInterval(state.time)
  }

  // 적 접근·코어 피격
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i]
    enemy.r -= enemy.speed * dt
    if (enemy.r <= CORE_R) {
      state.enemies.splice(i, 1)
      state.lives -= 1
      events.leaked = true
    }
  }

  // 탄환 이동·명중
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (Math.hypot(b.x - CENTER_X, b.y - CENTER_Y) > SPAWN_R + 60) {
      state.bullets.splice(i, 1)
      state.streak = 0
      events.missed = true
      continue
    }
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j]
      const ex = CENTER_X + Math.cos(enemy.angle) * enemy.r
      const ey = CENTER_Y + Math.sin(enemy.angle) * enemy.r
      if (Math.hypot(b.x - ex, b.y - ey) > enemy.size + 8) continue
      state.bullets.splice(i, 1)
      enemy.hp -= 1
      if (enemy.hp <= 0) {
        state.enemies.splice(j, 1)
        state.streak += 1
        state.score = Math.min(1_000_000, state.score + 10 + Math.min(state.streak, 20) * 2)
        events.kills.push({ x: ex, y: ey })
      }
      break
    }
  }

  if (state.lives <= 0) {
    state.lives = 0
    state.phase = 'over'
    state.overTimer = 0.9
  }
  return events
}

// 탭: 현재 포탑 방향으로 발사
export function fire(state: OrbitState): boolean {
  if (state.phase !== 'playing' || state.cooldown > 0) return false
  state.cooldown = FIRE_COOLDOWN
  state.bullets.push({
    x: CENTER_X + Math.cos(state.angle) * 52,
    y: CENTER_Y + Math.sin(state.angle) * 52,
    vx: Math.cos(state.angle) * BULLET_SPEED,
    vy: Math.sin(state.angle) * BULLET_SPEED,
  })
  return true
}
