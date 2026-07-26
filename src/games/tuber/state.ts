// 유튜버 시뮬 — 주제 고르고(트렌드 반영) 타이밍 미니게임으로 편집 품질을 정해
// 영상을 올린다. 조회수 → 구독자 복리 성장. 제한 시간 내 구독자 수가 점수.

export type Phase = 'pick' | 'timing' | 'result' | 'over'

export const TOPIC_COUNT = 8
export const ROUNDS = 3 // 촬영·편집·썸네일

export interface TuberState {
  phase: Phase
  subs: number
  timeLeft: number
  topics: number[] // 선택지 3개 (주제 인덱스)
  trend: number // 지금 인기 주제
  trendTimer: number
  chosen: number
  round: number
  cursor: number // 0~1 왕복
  cursorDir: 1 | -1
  zoneCenter: number
  zoneHalf: number
  accs: number[]
  lastViews: number
  lastSubs: number
  resultTimer: number
  overTimer: number
  playTime: number
}

function pickTopics(state: TuberState) {
  const pool = Array.from({ length: TOPIC_COUNT }, (_, i) => i)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // 트렌드 주제가 자주 보이도록 절반 확률로 끼워 넣는다
  state.topics = pool.slice(0, 3)
  if (!state.topics.includes(state.trend) && Math.random() < 0.5) {
    state.topics[Math.floor(Math.random() * 3)] = state.trend
  }
}

export function createState(): TuberState {
  const state: TuberState = {
    phase: 'pick',
    subs: 0,
    timeLeft: 180,
    topics: [],
    trend: Math.floor(Math.random() * TOPIC_COUNT),
    trendTimer: 25,
    chosen: 0,
    round: 0,
    cursor: 0,
    cursorDir: 1,
    zoneCenter: 0.5,
    zoneHalf: 0.1,
    accs: [],
    lastViews: 0,
    lastSubs: 0,
    resultTimer: 0,
    overTimer: 0,
    playTime: 0,
  }
  pickTopics(state)
  return state
}

const cursorSpeed = (round: number) => 1.0 + round * 0.3

export interface TickEvents {
  trendChanged: boolean
  timeUp: boolean
}

export function update(state: TuberState, dt: number): TickEvents {
  const events: TickEvents = { trendChanged: false, timeUp: false }
  if (state.phase === 'over') return events

  state.timeLeft -= dt
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.phase = 'over'
    state.overTimer = 0.8
    events.timeUp = true
    return events
  }

  state.trendTimer -= dt
  if (state.trendTimer <= 0) {
    state.trendTimer = 25
    const prev = state.trend
    state.trend = Math.floor(Math.random() * TOPIC_COUNT)
    if (state.trend === prev) state.trend = (state.trend + 1) % TOPIC_COUNT
    events.trendChanged = true
    if (state.phase === 'pick') pickTopics(state)
  }

  if (state.phase === 'timing') {
    state.cursor += state.cursorDir * cursorSpeed(state.round) * dt
    if (state.cursor > 1) {
      state.cursor = 2 - state.cursor
      state.cursorDir = -1
    } else if (state.cursor < 0) {
      state.cursor = -state.cursor
      state.cursorDir = 1
    }
  } else if (state.phase === 'result') {
    state.resultTimer -= dt
    if (state.resultTimer <= 0) {
      state.phase = 'pick'
      pickTopics(state)
    }
  }
  return events
}

function startRound(state: TuberState) {
  state.cursor = Math.random()
  state.cursorDir = Math.random() < 0.5 ? 1 : -1
  state.zoneCenter = 0.25 + Math.random() * 0.5
  state.zoneHalf = 0.1
}

export function pickTopic(state: TuberState, slot: number) {
  if (state.phase !== 'pick') return
  state.chosen = state.topics[slot]
  state.round = 0
  state.accs = []
  state.phase = 'timing'
  startRound(state)
}

// 탭으로 커서 고정 — 존 중심에 가까울수록 정확도가 높다
export function lockTiming(state: TuberState): number | null {
  if (state.phase !== 'timing') return null
  const dist = Math.abs(state.cursor - state.zoneCenter)
  const acc = Math.max(0, 1 - dist / (state.zoneHalf * 2.5))
  state.accs.push(acc)
  state.round += 1
  if (state.round >= ROUNDS) {
    uploadVideo(state)
  } else {
    startRound(state)
  }
  return acc
}

function uploadVideo(state: TuberState) {
  const q = state.accs.reduce((a, b) => a + b, 0) / ROUNDS
  const trendMult = state.chosen === state.trend ? 1.6 : 1
  const luck = 0.8 + Math.random() * 0.4
  const views = Math.floor((100 + state.subs * 0.35) * (0.4 + 1.1 * q) * trendMult * luck)
  const gained = Math.max(1, Math.floor(views * (0.04 + 0.06 * q)))
  state.lastViews = views
  state.lastSubs = gained
  state.subs = Math.min(1_000_000, state.subs + gained)
  state.phase = 'result'
  state.resultTimer = 2.2
}
