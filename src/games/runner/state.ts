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
// 이 시간 안에 떼면 짧은 점프로 되돌린다. 누른 시간이 정점을 연속으로 바꾸면
// 사람이 흔히 내는 60~120ms짜리 탭이 165도 220도 아닌 어중간한 높이(180~195)를 만들어
// 두 코인 줄에 다 걸친다 — 실제로 그래서 체인이 한 번도 안 끊겼다. 탭과 누름을 갈라 둔다.
export const HOLD_CUT = 0.16

export const SHORT_H = (JUMP_V * JUMP_V) / (2 * GRAVITY) // 165
export const HOLD_H = (JUMP_V * JUMP_V) / (2 * HOLD_GRAVITY) // 220
const SHORT_AIR = (2 * -JUMP_V) / GRAVITY // 0.61초
const HOLD_RISE = -JUMP_V / HOLD_GRAVITY // 0.40초
const HOLD_AIR = HOLD_RISE + Math.sqrt((2 * HOLD_H) / GRAVITY) // 0.75초
// 2단까지 끝까지 눌렀을 때 땅에 닿기까지. 보너스 줄 뒤에 둘 여유를 이걸로 잡는다
const DOUBLE_AIR = HOLD_RISE * 2 + Math.sqrt((2 * HOLD_H * 2) / GRAVITY) // 1.30초
// 착지한 뒤 다음 것에 손을 쓸 여유. 이게 곧 실수를 봐주는 폭이라, 서서히 줄여서
// 속도가 950에서 멎은 뒤에도 판이 계속 조여지게 한다.
// 속도를 더 올리는 것은 답이 아니다 — 빠를수록 장애물을 지나가는 시간은 오히려 짧아지고
// 화면에서 보이는 시간만 줄어, 예전처럼 반응속도 시험으로 되돌아간다.
function reactAt(time: number): number {
  return Math.max(0.13, 0.22 - time / 1300)
}

// 공중 장애물 = 허공에 뜬 바위 처마. 아래 틈으로 낮게 지나가는 것이 정답이고,
// 2단을 제대로 쓰면 위로 넘어가는 길도 있다 (한 번 뛰어서는 220px이라 절대 못 넘는다 —
// 반사적으로 누르면 죽는 것은 그대로다).
// 예전에는 천장부터 이어진 기둥이라 세로 820px, 화면의 3분의 2를 덮었다.
export const OVERHANG_BOTTOM = GROUND_Y - 100 // 800 — 아래로 지나갈 틈
export const OVERHANG_TOP = GROUND_Y - 260 // 640 — 넘어가려면 2단이 필요한 높이

// 판을 시작할 때 첫 장애물까지 두는 여유. 광고 이어하기도 같은 몫을 받는다
export const START_SPAWN_DELAY = 1.4

const SPAWN_X = 760
const OVERHANG_W = 130
// 코인 줄은 몸통 한가운데를 지난다
const COIN_OFFSET = PLAYER_H / 2
// 코인에 닿는 세로 여유. 몸통 전체(위 20·아래 10 = 94px)로 잡았더니 짧은 점프(165)와
// 홀드 점프(220)의 판정이 171~210에서 겹쳐서, 홀드를 23~231ms 아무 데나 눌러도
// 모든 코인 줄이 다 들어왔다 — 배수가 상수가 됐다. 두 줄이 갈리는 폭으로 좁힌다.
const COIN_REACH = 30
// 고공 보너스. 2단 정점(440)에 딱 맞춰 뒀더니 두 번 다 끝까지 눌러야만 닿았고
// (탭이 하나만 섞여도 304·327px에 그친다) 그마저 판정 하한 턱걸이라 사실상 못 먹었다.
// 어떤 2단이든 지나가는 높이로 내리고 여유도 넓힌다. 한 번 뛰어서는 220px이라 여전히 안 닿는다.
const BONUS_H = 345
const BONUS_REACH = 65

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
  // 2단을 다 써야 닿는 고공 줄. 코인 중에 유일하게 '먹는 데 대가가 있는' 것이라
  // (점프 두 번을 쓰고 1.3초를 떠 있는다) 체인의 실질적인 난관이 여기다. 그림도 다르게 그린다.
  bonus: boolean
}

// ── 패턴 청크 ────────────────────────────────────────────
// 가로 위치를 픽셀이 아니라 초로 적는다. 픽셀로 적으면 같은 배치가 느릴 때는 널널하고
// 빠를 때는 못 지나가는 것이 된다 — 사람이 쓰는 것은 시간이지 거리가 아니다.
type Piece =
  | { t: 'rock'; dt: number; w: number; h: number }
  | { t: 'overhang'; dt: number }
  // 점프 궤적을 따라가는 코인 줄. 어느 높이로 뛰라는 지시다
  | { t: 'arc'; dt: number; hold: boolean }
  // 처마 아래 틈을 낮게 지나갈 때 딸려오는 줄
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

// 낮은 것 셋을 끝까지 눌러 한 번에 건너뛰는 계단. 같은 패턴을 티어마다 좁혀서 낸다 —
// 외운 패턴이 계속 조여지는 것이 속도가 멎은 뒤의 후반 난이도다.
// 간격 0.17이면 타이밍 여유 ±88ms, 0.20이면 ±59ms, 0.215면 ±44ms.
const stair = (tier: number, gap: number): Chunk => ({
  pieces: [
    { t: 'rock', dt: 0, w: 44, h: 46 },
    { t: 'rock', dt: gap, w: 44, h: 46 },
    { t: 'rock', dt: gap * 2, w: 44, h: 46 },
    { t: 'arc', dt: gap, hold: true },
  ],
  span: gap * 2 + 0.16,
  rest: 0.8,
  exitAir: HOLD_AIR,
  tier,
})

const CHUNKS: Chunk[] = [
  stair(2, 0.17),
  stair(3, 0.2),
  stair(4, 0.215),
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
    // 허공에 뜬 처마. 한 번 뛰어서는 못 넘으니 낮게 지나가고, 그러면 아래 코인이 붙는다 —
    // '가만히 있기'였던 것이 '낮게 훑고 지나가기'가 된다
    pieces: [
      { t: 'overhang', dt: 0 },
      { t: 'low', dt: 0.012, n: 3 },
    ],
    span: 0.34,
    rest: 0.6,
    exitAir: 0,
    tier: 0,
  },
  {
    // 낮은 바위 뒤에 처마. 뛰고 곧바로 낮게 붙는 것을 여유 있게 익힌다
    pieces: [
      { t: 'rock', dt: 0, w: 64, h: 80 },
      { t: 'arc', dt: 0.035, hold: false },
      { t: 'overhang', dt: 0.95 },
      { t: 'low', dt: 0.962, n: 3 },
    ],
    span: 1.3,
    rest: 0.65,
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
    // 처마를 낮게 지나자마자 바위. 참았다가 바로 뛰어야 한다
    pieces: [
      { t: 'overhang', dt: 0 },
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
    // 뛰고 → 내려서고 → 다시 뛴다. 뜬 채로 처마에 닿으면 끝이라 짧게 끊어 뛰어야 한다
    pieces: [
      { t: 'rock', dt: 0, w: 64, h: 85 },
      { t: 'arc', dt: 0.035, hold: false },
      { t: 'overhang', dt: 1 },
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
    // 높은 바위를 크게 넘자마자 처마 — 뜬 채로는 못 지나간다
    pieces: [
      { t: 'rock', dt: 0, w: 48, h: 175 },
      { t: 'arc', dt: 0.03, hold: true },
      { t: 'overhang', dt: 0.95 },
      { t: 'low', dt: 0.962, n: 3 },
    ],
    span: 1.3,
    rest: 0.7,
    exitAir: 0,
    tier: 3,
  },
  {
    // 붙은 두 개 → 처마 → 바위. 크게 한 번, 참고, 다시 짧게
    pieces: [
      { t: 'rock', dt: 0, w: 56, h: 70 },
      { t: 'rock', dt: 0.24, w: 56, h: 70 },
      { t: 'arc', dt: 0.13, hold: true },
      { t: 'overhang', dt: 1.15 },
      { t: 'low', dt: 1.162, n: 3 },
      { t: 'rock', dt: 1.9, w: 64, h: 85 },
      { t: 'arc', dt: 1.935, hold: false },
    ],
    span: 2.06,
    rest: 0.7,
    exitAir: SHORT_AIR,
    tier: 3,
  },
  {
    // 낮게 붙어 지나가자마자 크게 넘고, 다시 낮게 붙는다
    pieces: [
      { t: 'overhang', dt: 0 },
      { t: 'low', dt: 0.012, n: 3 },
      { t: 'rock', dt: 0.78, w: 56, h: 70 },
      { t: 'rock', dt: 1.02, w: 56, h: 70 },
      { t: 'arc', dt: 0.91, hold: true },
      { t: 'overhang', dt: 1.95 },
      { t: 'low', dt: 1.962, n: 3 },
    ],
    span: 2.3,
    rest: 0.7,
    exitAir: 0,
    tier: 4,
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
  return time < 20 ? 0 : time < 45 ? 1 : time < 75 ? 2 : time < 120 ? 3 : 4
}

function pickChunk(state: RunnerState): Chunk {
  // 초반엔 자주 쉬고 뒤로 갈수록 덜 쉰다. 쉼 구간은 나갈 때 1.3초를 비워야 해서
  // 실제로는 판에서 가장 긴 구간이라, 후반에 넷에 하나면 빈 길이 눈에 띈다
  const restEvery = state.time < 45 ? 4 : 6
  if (state.chunkIndex % restEvery === restEvery - 1) return REST_CHUNK
  const tier = tierAt(state.time)
  // 속도가 950에서 멎은 뒤로는 이것이 유일한 난이도 레버다 — 어려운 쪽에서 뽑을 확률을 올린다
  const hard = tier > 0 && Math.random() < Math.min(0.8, state.time / 110)
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
    else if (p.t === 'overhang') state.obstacles.push({ x, w: OVERHANG_W, h: 0, air: true })
    else if (p.t === 'arc') pushArc(state, x, p.hold, speed)
    else if (p.t === 'low') {
      // 땅을 달리며 줍는 줄이라 간격은 속도와 무관하게 눈에 보이는 대로 둔다.
      // 처마 폭(130) 안에 들어가야 '틈으로 지나가면 딸려온다'로 읽힌다
      const lowY = GROUND_Y - COIN_OFFSET - 10
      for (let i = 0; i < p.n; i++) state.coins.push({ x: x + i * 40, y: lowY, bonus: false })
    } else {
      // 정점 언저리에 뭉쳐 둔다. 넓게 늘어놓으면 정점에 머무는 짧은 순간에 다 못 훑는다
      const highY = GROUND_Y - BONUS_H - COIN_OFFSET
      for (let i = 0; i < 3; i++) state.coins.push({ x: x + i * 52, y: highY, bonus: true })
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
  if (!state.holding) return
  state.holding = false
  if (state.holdTime >= HOLD_CUT || state.vy >= 0) return
  // 올라가던 것을 짧은 점프의 정점에서 멈춘다
  const h = GROUND_Y - state.playerY
  state.vy = h >= SHORT_H ? 0 : -Math.sqrt(2 * GRAVITY * (SHORT_H - h))
}

export interface UpdateResult {
  died: boolean
  // 착지한 프레임 — 먼지와 눌림 연출의 신호
  landed: boolean
  // 먹은 코인 자리와 그때의 값 (효과를 그 자리에 터뜨린다)
  coinSpots: Array<{ x: number; y: number; value: number; bonus: boolean }>
  chainBroke: boolean
  multUp: boolean
  // 무엇에 부딪혔는지 — 왜 죽었는지 화면이 말하게 하는 데 쓴다
  killer: Obstacle | null
}

export function update(state: RunnerState, dt: number): UpdateResult {
  state.time += dt
  const speed = speedAt(state.time)
  state.distance += speed * dt
  const multBefore = multOf(state.chain)
  state.score += ((speed * dt) / 60) * multBefore

  const wasAirborne = state.playerY < GROUND_Y
  if (state.holding) {
    state.holdTime += dt
    // pointercancel이 나면 onUp이 영영 안 온다. holdTime은 점프마다 0으로 돌아가므로
    // 눌린 채로 두면 그 뒤 모든 점프가 최대 높이로 나가고, 본인은 이유를 모른다.
    if (state.holdTime >= HOLD_MAX) state.holding = false
  }
  const lifting = state.holding && state.vy < 0
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
    state.spawnTimer = shift + chunk.span + Math.max(chunk.rest, chunk.exitAir + reactAt(state.time))
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
      if (state.chain > 0) {
        state.chain = 0
        chainBroke = true
      }
      return false
    }
    const hit =
      Math.abs(coin.x - PLAYER_X) < PLAYER_W / 2 + 20 &&
      Math.abs(coin.y - (state.playerY - COIN_OFFSET)) < (coin.bonus ? BONUS_REACH : COIN_REACH)
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
    const oy1 = o.air ? OVERHANG_TOP : GROUND_Y - o.h
    const oy2 = o.air ? OVERHANG_BOTTOM : GROUND_Y
    if (px2 > o.x && px1 < o.x + o.w && state.playerY > oy1 && top < oy2) {
      state.phase = 'over'
      return { died: true, landed, coinSpots, chainBroke, multUp: false, killer: o }
    }
  }
  return {
    died: false,
    landed,
    coinSpots,
    chainBroke,
    multUp: multOf(state.chain) > multBefore,
    killer: null,
  }
}
