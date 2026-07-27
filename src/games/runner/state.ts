// 무한 러너 — 탭 점프(2단), 장애물 회피 + 코인 수집

export const GROUND_Y = 900
export const PLAYER_X = 160
export const PLAYER_W = 56
export const PLAYER_H = 64
export const GRAVITY = 3600
export const JUMP_V = -1250
// 공중 장애물 = 천장에서 내려온 벽. 아래 틈으로만 지나갈 수 있으니 점프하면 죽는다.
// 예전에는 허공에 뜬 막대라 높이 뛰면 위로 넘어가졌고, 넘어야 하는지 지나야 하는지가 불분명했다.
export const AIR_BAR_BOTTOM = GROUND_Y - 100

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

// 예전엔 34초면 최고 속도에 닿아 그 뒤로 난이도가 멈췄다 — 천천히, 더 멀리 오르게 바꿨다
export function speedAt(time: number): number {
  return Math.min(1300, 420 + time * 10)
}

// 거리가 빠르게 쌓여 다른 게임의 6배였다 — 환산 비율을 낮춘다
export function scoreOf(state: RunnerState): number {
  return Math.floor(state.distance / 60) + state.coinScore
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
  // 착지한 프레임 — 먼지와 눌림 연출의 신호
  landed: boolean
  // 먹은 코인 자리 (효과를 그 자리에 터뜨린다)
  coinSpots: Array<{ x: number; y: number }>
}

export function update(state: RunnerState, dt: number): UpdateResult {
  state.time += dt
  const speed = speedAt(state.time)
  state.distance += speed * dt

  const wasAirborne = state.playerY < GROUND_Y
  state.vy += GRAVITY * dt
  state.playerY += state.vy * dt
  let landed = false
  if (state.playerY >= GROUND_Y) {
    state.playerY = GROUND_Y
    state.vy = 0
    state.jumpsLeft = 2
    landed = wasAirborne
  }

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    // 간격을 시간이 아니라 거리로 잡는다. 시간 기준이면 후반 속도에서 점프 체공(0.69초)보다
    // 짧은 간격이 나와 피할 수 없는 조합이 생긴다.
    state.spawnTimer = (680 + Math.random() * 560) / speed
    if (Math.random() < 0.3) {
      state.obstacles.push({ x: 760, w: 90, h: 0, air: true })
    } else {
      // 높이 150짜리는 초반 저속에서 점프 성공 창이 14ms뿐이라 사실상 못 넘었다.
      // 최악 조건에서도 100ms는 남도록 낮췄다.
      state.obstacles.push({
        x: 760,
        w: 40 + Math.random() * 50,
        h: 55 + Math.random() * 60,
        air: false,
      })
    }
  }

  state.coinTimer -= dt
  if (state.coinTimer <= 0) {
    // 장애물과 겹치면 코인을 먹으러 가다 죽는다 — 자리가 비었고 곧 생기지도 않을 때만 놓는다
    if (state.spawnTimer < 0.6 || state.obstacles.some((o) => o.x + o.w > 700 && o.x < 1000)) {
      state.coinTimer = 0.5
    } else {
      state.coinTimer = 2.5 + Math.random() * 2
      const y = GROUND_Y - (200 + Math.random() * 160)
      for (let k = 0; k < 3; k++) state.coins.push({ x: 760 + k * 70, y })
    }
  }

  for (const o of state.obstacles) o.x -= speed * dt
  for (const coin of state.coins) coin.x -= speed * dt
  state.obstacles = state.obstacles.filter((o) => o.x + o.w > -20)

  // 코인 획득
  let coinsTaken = 0
  const coinSpots: Array<{ x: number; y: number }> = []
  const top = state.playerY - PLAYER_H
  state.coins = state.coins.filter((coin) => {
    if (coin.x < -20) return false
    const hit =
      Math.abs(coin.x - PLAYER_X) < PLAYER_W / 2 + 20 &&
      coin.y > top - 20 &&
      coin.y < state.playerY + 10
    if (hit) {
      coinsTaken += 1
      state.coinScore += 3
      coinSpots.push({ x: coin.x, y: coin.y })
      return false
    }
    return true
  })

  // 충돌
  const px1 = PLAYER_X - PLAYER_W / 2
  const px2 = PLAYER_X + PLAYER_W / 2
  for (const o of state.obstacles) {
    const oy1 = o.air ? 0 : GROUND_Y - o.h
    const oy2 = o.air ? AIR_BAR_BOTTOM : GROUND_Y
    if (px2 > o.x && px1 < o.x + o.w && state.playerY > oy1 && top < oy2) {
      state.phase = 'over'
      return { died: true, coinsTaken, landed, coinSpots }
    }
  }
  return { died: false, coinsTaken, landed, coinSpots }
}
