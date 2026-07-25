// 무한 러너 — 탭 점프(2단), 장애물 회피 + 코인 수집

export const GROUND_Y = 900
export const PLAYER_X = 160
export const PLAYER_W = 56
export const PLAYER_H = 64
export const GRAVITY = 3600
export const JUMP_V = -1250
export const AIR_BAR_TOP = GROUND_Y - 240 // 공중 장애물(점프 금지 구간)

export type Phase = 'playing' | 'over'

export interface Obstacle {
  x: number
  w: number
  h: number
  air: boolean
}

export interface Coin {
  x: number
  y: number
}

export interface RunnerState {
  phase: Phase
  time: number
  distance: number
  coinScore: number
  playerY: number
  vy: number
  jumpsLeft: number
  obstacles: Obstacle[]
  coins: Coin[]
  spawnTimer: number
  coinTimer: number
}

export function speedAt(time: number): number {
  return Math.min(900, 420 + time * 14)
}

export function scoreOf(state: RunnerState): number {
  return Math.floor(state.distance / 10) + state.coinScore
}

export function createState(): RunnerState {
  return {
    phase: 'playing',
    time: 0,
    distance: 0,
    coinScore: 0,
    playerY: GROUND_Y,
    vy: 0,
    jumpsLeft: 2,
    obstacles: [],
    coins: [],
    spawnTimer: 1.4,
    coinTimer: 3,
  }
}

export interface UpdateResult {
  died: boolean
  coinsTaken: number
}

export function update(state: RunnerState, dt: number): UpdateResult {
  state.time += dt
  const speed = speedAt(state.time)
  state.distance += speed * dt

  state.vy += GRAVITY * dt
  state.playerY += state.vy * dt
  if (state.playerY >= GROUND_Y) {
    state.playerY = GROUND_Y
    state.vy = 0
    state.jumpsLeft = 2
  }

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = 0.75 + Math.random() * 0.9
    if (Math.random() < 0.3) {
      state.obstacles.push({ x: 760, w: 90, h: 70, air: true })
    } else {
      state.obstacles.push({
        x: 760,
        w: 40 + Math.random() * 60,
        h: 60 + Math.random() * 90,
        air: false,
      })
    }
  }

  state.coinTimer -= dt
  if (state.coinTimer <= 0) {
    state.coinTimer = 2.5 + Math.random() * 2
    const y = GROUND_Y - (200 + Math.random() * 160)
    for (let k = 0; k < 3; k++) state.coins.push({ x: 760 + k * 70, y })
  }

  for (const o of state.obstacles) o.x -= speed * dt
  for (const coin of state.coins) coin.x -= speed * dt
  state.obstacles = state.obstacles.filter((o) => o.x + o.w > -20)

  // 코인 획득
  let coinsTaken = 0
  const top = state.playerY - PLAYER_H
  state.coins = state.coins.filter((coin) => {
    if (coin.x < -20) return false
    const hit =
      Math.abs(coin.x - PLAYER_X) < PLAYER_W / 2 + 20 &&
      coin.y > top - 20 &&
      coin.y < state.playerY + 10
    if (hit) {
      coinsTaken += 1
      state.coinScore += 15
      return false
    }
    return true
  })

  // 충돌
  const px1 = PLAYER_X - PLAYER_W / 2
  const px2 = PLAYER_X + PLAYER_W / 2
  for (const o of state.obstacles) {
    const oy1 = o.air ? AIR_BAR_TOP : GROUND_Y - o.h
    const oy2 = o.air ? AIR_BAR_TOP + o.h : GROUND_Y
    if (px2 > o.x && px1 < o.x + o.w && state.playerY > oy1 && top < oy2) {
      state.phase = 'over'
      return { died: true, coinsTaken }
    }
  }
  return { died: false, coinsTaken }
}
