// 무한 러너 — 누른 만큼 뛰는 탭 점프(2단), 패턴 청크 회피 + 코인 체인

export const GROUND_Y = 900
export const PLAYER_X = 160
export const PLAYER_W = 56
export const PLAYER_H = 64
export const GRAVITY = 3600
export const JUMP_V = -1090
// 누르고 있는 동안만 상승 중력을 낮춘다 — 바로 떼면 165px, 끝까지 누르면 220px.
// 탭 하나로 높이를 고르는 것이라 새로 배울 제스처가 없고, 코인 줄이 어느 쪽을 쓰라고 알려준다.
export const HOLD_GRAVITY = 2700
// pointercancel로 onUp이 안 올 때가 있다. 홀드가 눌린 채 굳지 않게 상한을 둔다
export const HOLD_MAX = 0.42

export const SHORT_H = (JUMP_V * JUMP_V) / (2 * GRAVITY) // 165
export const HOLD_H = (JUMP_V * JUMP_V) / (2 * HOLD_GRAVITY) // 220
const SHORT_AIR = (2 * -JUMP_V) / GRAVITY // 0.61초
const HOLD_RISE = -JUMP_V / HOLD_GRAVITY // 0.40초
const HOLD_AIR = HOLD_RISE + Math.sqrt((2 * HOLD_H) / GRAVITY) // 0.75초
// 2단까지 끝까지 눌렀을 때 땅에 닿기까지. 보너스 줄 뒤에 둘 여유를 이걸로 잡는다
const DOUBLE_AIR = HOLD_RISE * 2 + Math.sqrt((2 * HOLD_H * 2) / GRAVITY) // 1.30초
// 다음 것을 보고 손을 쓸 시간
const REACT = 0.22

// 공중 장애물 = 천장에서 내려온 벽. 아래 틈으로만 지나갈 수 있으니 점프하면 죽는다.
export const AIR_BAR_BOTTOM = GROUND_Y - 100

// 판을 시작할 때 첫 장애물까지 두는 여유. 광고 이어하기도 같은 몫을 받는다
export const START_SPAWN_DELAY = 1.4

const SPAWN_X = 760
const WALL_W = 90
// 코인이 몸에 닿는 세로 폭(머리 위 20 · 발밑 10)의 한가운데
const COIN_OFFSET = 35

// 연달아 먹은 개수가 배수를 올리고, 하나라도 흘리면 1배로 돌아간다.
// 살아 있는 것 말고 잃을 것이 하나 더 있어야 판이 팽팽해진다.
export const CHAIN_STEP = 6
export const MAX_MULT = 5

export function multOf(chain: number): number {
  return Math.min(MAX_MULT, 1 + Math.floor(chain / CHAIN_STEP))
}

// 예전엔 1300까지 올라가 장애물이 화면에 뜨고 몸에 닿기까지 0.44초밖에 없었다.
// 그 속도에서는 코인 줄을 읽을 시간이 안 나온다 — 0.60초에서 멈추고,
// 그 뒤의 난이도는 청크 구성으로 올린다.
export function speedAt(time: number): number {
  return Math.min(950, 420 + time * 9)
}

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
  // 고공 보너스 — 안 먹어도 체인이 끊기지 않는다. 먹을지 말지가 선택이어야 하므로
  bonus: boolean
}

// ── 패턴 청크 ────────────────────────────────────────────
// 가로 위치를 픽셀이 아니라 초로 적는다. 픽셀로 적으면 같은 배치가 느릴 때는 널널하고
// 빠를 때는 못 지나가는 것이 된다 — 사람이 쓰는 것은 시간이지 거리가 아니다.
type Piece =
  | { t: 'rock'; dt: number; w: number; h: number }
  | { t: 'wall'; dt: number }
  // 점프 궤적을 따라가는 코인 줄. 어느 높이로 뛰라는 지시다
  | { t: 'arc'; dt: number; hold: boolean }
  // 벽 아래 틈을 낮게 지나갈 때 딸려오는 줄
  | { t: 'low'; dt: number; n: number }
  // 2단을 끝까지 눌러야 닿는 보너스
  | { t: 'high'; dt: number }

interface Chunk {
  pieces: Piece[]
  // 머리부터 꼬리까지 (초)
  span: number
  // 다음 청크까지 최소한 둘 여유 (초)
  rest: number
  // 이 청크를 나갈 때 떠 있는 시간. 이걸 안 지키면 손도 못 대고 죽는 조합이 나온다
  exitAir: number
  tier: number
}

const CHUNKS: Chunk[] = [
  {
    // 낮은 바위 하나. 짧게 뛰면 코인 줄이 그대로 손에 들어온다
    pieces: [
      { t: 'rock', dt: 0, w: 64, h: 80 },
      { t: 'arc', dt: 0.035, hold: false },
    ],
    span: 0.16,
    rest: 0.75,
    exitAir: SHORT_AIR,
    tier: 0,
  },
  {
    // 천장 벽. 뛰면 죽고, 낮게 지나가면 아래 코인이 붙는다 —
    // '가만히 있기'였던 것이 '낮게 훑고 지나가기'가 된다
    pieces: [
      { t: 'wall', dt: 0 },
      { t: 'low', dt: 0.012, n: 3 },
    ],
    span: 0.24,
    rest: 0.6,
    exitAir: 0,
    tier: 0,
  },
  {
    // 붙어 있는 두 개 — 하나씩 넘을 틈이 없다. 크게 한 번에 넘긴다
    pieces: [
      { t: 'rock', dt: 0, w: 56, h: 70 },
      { t: 'rock', dt: 0.24, w: 56, h: 70 },
      { t: 'arc', dt: 0.13, hold: true },
    ],
    span: 0.4,
    rest: 0.75,
    exitAir: HOLD_AIR,
    tier: 1,
  },
  {
    // 짧은 점프(165)로는 못 넘는 높이. 여기서 길게 누르는 걸 배운다
    pieces: [
      { t: 'rock', dt: 0, w: 48, h: 175 },
      { t: 'arc', dt: 0.03, hold: true },
    ],
    span: 0.16,
    rest: 0.8,
    exitAir: HOLD_AIR,
    tier: 1,
  },
  {
    // 벽을 낮게 지나자마자 바위. 참았다가 바로 뛰어야 한다
    pieces: [
      { t: 'wall', dt: 0 },
      { t: 'low', dt: 0.012, n: 3 },
      { t: 'rock', dt: 0.72, w: 64, h: 88 },
      { t: 'arc', dt: 0.755, hold: false },
    ],
    span: 0.88,
    rest: 0.7,
    exitAir: SHORT_AIR,
    tier: 1,
  },
  {
    // 뛰고 → 내려서고 → 다시 뛴다. 높이 뜬 채로 벽에 닿으면 끝이라 짧게 끊어 뛰어야 한다
    pieces: [
      { t: 'rock', dt: 0, w: 64, h: 85 },
      { t: 'arc', dt: 0.035, hold: false },
      { t: 'wall', dt: 1 },
      { t: 'low', dt: 1.012, n: 3 },
      { t: 'rock', dt: 1.75, w: 64, h: 85 },
      { t: 'arc', dt: 1.785, hold: false },
    ],
    span: 1.91,
    rest: 0.7,
    exitAir: SHORT_AIR,
    tier: 2,
  },
  {
    // 낮은 것 셋. 끝까지 눌러 한 번에 건너뛴다
    pieces: [
      { t: 'rock', dt: 0, w: 48, h: 50 },
      { t: 'rock', dt: 0.21, w: 48, h: 50 },
      { t: 'rock', dt: 0.42, w: 48, h: 50 },
      { t: 'arc', dt: 0.21, hold: true },
    ],
    span: 0.58,
    rest: 0.8,
    exitAir: HOLD_AIR,
    tier: 2,
  },
]

// 네 번에 한 번 끼우는 숨 고르기. 빈 길만 두면 심심하니 2단으로만 닿는 보너스를 걸어 둔다
const REST_CHUNK: Chunk = {
  pieces: [{ t: 'high', dt: 0.1 }],
  span: 0.35,
  rest: 0.9,
  exitAir: DOUBLE_AIR,
  tier: 0,
}

function tierAt(time: number): number {
  return time < 20 ? 0 : time < 45 ? 1 : 2
}

function pickChunk(state: RunnerState): Chunk {
  if (state.chunkIndex % 4 === 3) return REST_CHUNK
  const tier = tierAt(state.time)
  // 속도가 950에서 멎은 뒤로는 이것이 유일한 난이도 레버다 — 어려운 쪽에서 뽑을 확률을 올린다
  const hard = tier > 0 && Math.random() < Math.min(0.65, state.time / 90)
  const pool = CHUNKS.filter((ch) => (hard ? ch.tier === tier : ch.tier <= tier))
  return pool[Math.floor(Math.random() * pool.length)]
}

// 정점 부근의 궤적을 따라 다섯 알. 정점을 지나면 양쪽 다 자유낙하라 곡률 하나로 잡는다
const ARC_STEP = 0.068
const ARC_LEAD = ARC_STEP * 2

function pushArc(state: RunnerState, cx: number, hold: boolean, speed: number) {
  const peak = hold ? HOLD_H : SHORT_H
  for (let i = -2; i <= 2; i++) {
    const dt = i * ARC_STEP
    const h = peak - (GRAVITY / 2) * dt * dt
    if (h < 30) continue
    state.coins.push({ x: cx + dt * speed, y: GROUND_Y - h - COIN_OFFSET, bonus: false })
  }
}

// 코인 줄은 바위보다 앞에서 시작한다. 그만큼 통째로 밀어 두지 않으면 화면 안에서
// 코인이 툭 튀어나온다. 민 시간은 다음 청크까지의 여유에 그대로 더한다.
function placeChunk(state: RunnerState, chunk: Chunk, speed: number): number {
  let lead = 0
  for (const p of chunk.pieces) {
    const head = p.t === 'arc' ? p.dt - ARC_LEAD : p.dt
    if (head < lead) lead = head
  }
  for (const p of chunk.pieces) {
    const x = SPAWN_X + (p.dt - lead) * speed
    if (p.t === 'rock') state.obstacles.push({ x, w: p.w, h: p.h, air: false })
    else if (p.t === 'wall') state.obstacles.push({ x, w: WALL_W, h: 0, air: true })
    else if (p.t === 'arc') pushArc(state, x, p.hold, speed)
    else if (p.t === 'low') {
      // 땅을 달리며 줍는 줄이라 간격은 속도와 무관하게 눈에 보이는 대로 둔다.
      // 벽 폭(90) 안에 들어가야 '틈으로 지나가면 딸려온다'로 읽힌다
      for (let i = 0; i < p.n; i++) state.coins.push({ x: x + i * 36, y: GROUND_Y - 50, bonus: false })
    } else {
      // 2단 정점(440) 언저리에 두어 끝까지 누른 사람만 닿게 한다
      for (let i = 0; i < 3; i++) state.coins.push({ x: x + i * 70, y: GROUND_Y - 420, bonus: true })
    }
  }
  return -lead
}

export interface RunnerState {
  phase: Phase
  time: number
  distance: number
  score: number
  chain: number
  bestChain: number
  coinCount: number
  playerY: number
  vy: number
  jumpsLeft: number
  holding: boolean
  holdTime: number
  obstacles: Obstacle[]
  coins: Coin[]
  spawnTimer: number
  chunkIndex: number
}

export function scoreOf(state: RunnerState): number {
  return Math.floor(state.score)
}

export function createState(): RunnerState {
  return {
    phase: 'playing',
    time: 0,
    distance: 0,
    score: 0,
    chain: 0,
    bestChain: 0,
    coinCount: 0,
    playerY: GROUND_Y,
    vy: 0,
    jumpsLeft: 2,
    holding: false,
    holdTime: 0,
    obstacles: [],
    coins: [],
    spawnTimer: START_SPAWN_DELAY,
    chunkIndex: 0,
  }
}

export function jump(state: RunnerState): boolean {
  if (state.phase !== 'playing' || state.jumpsLeft <= 0) return false
  state.vy = JUMP_V
  state.jumpsLeft -= 1
  state.holding = true
  state.holdTime = 0
  return true
}

export function release(state: RunnerState) {
  state.holding = false
}

export interface UpdateResult {
  died: boolean
  // 착지한 프레임 — 먼지와 눌림 연출의 신호
  landed: boolean
  // 먹은 코인 자리와 그때의 값 (효과를 그 자리에 터뜨린다)
  coinSpots: Array<{ x: number; y: number; value: number; bonus: boolean }>
  chainBroke: boolean
  multUp: boolean
}

export function update(state: RunnerState, dt: number): UpdateResult {
  state.time += dt
  const speed = speedAt(state.time)
  state.distance += speed * dt
  const multBefore = multOf(state.chain)
  state.score += ((speed * dt) / 60) * multBefore

  const wasAirborne = state.playerY < GROUND_Y
  if (state.holding) state.holdTime += dt
  const lifting = state.holding && state.holdTime < HOLD_MAX && state.vy < 0
  state.vy += (lifting ? HOLD_GRAVITY : GRAVITY) * dt
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
    const chunk = pickChunk(state)
    const shift = placeChunk(state, chunk, speed)
    state.chunkIndex += 1
    state.spawnTimer = shift + chunk.span + Math.max(chunk.rest, chunk.exitAir + REACT)
  }

  for (const o of state.obstacles) o.x -= speed * dt
  for (const coin of state.coins) coin.x -= speed * dt
  state.obstacles = state.obstacles.filter((o) => o.x + o.w > -20)

  // 코인 획득 — 흘린 것은 체인을 끊는다
  const coinSpots: UpdateResult['coinSpots'] = []
  let chainBroke = false
  const top = state.playerY - PLAYER_H
  state.coins = state.coins.filter((coin) => {
    if (coin.x < -20) {
      if (!coin.bonus && state.chain > 0) {
        state.chain = 0
        chainBroke = true
      }
      return false
    }
    const hit =
      Math.abs(coin.x - PLAYER_X) < PLAYER_W / 2 + 20 &&
      coin.y > top - 20 &&
      coin.y < state.playerY + 10
    if (hit) {
      state.chain += 1
      state.coinCount += 1
      if (state.chain > state.bestChain) state.bestChain = state.chain
      const value = 3 * multOf(state.chain)
      state.score += value
      coinSpots.push({ x: coin.x, y: coin.y, value, bonus: coin.bonus })
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
      return { died: true, landed, coinSpots, chainBroke, multUp: false }
    }
  }
  return {
    died: false,
    landed,
    coinSpots,
    chainBroke,
    multUp: multOf(state.chain) > multBefore,
  }
}
