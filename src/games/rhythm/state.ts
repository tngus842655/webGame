// 리듬 탭 — 4레인으로 떨어지는 노트를 판정선에 맞춰 탭. 곡은 절차적으로 생성한
// 비트 패턴이며, 진행할수록 BPM과 밀도가 오른다. 놓친 노트가 쌓이면 게임 오버.

export type Phase = 'playing' | 'over'
export type Judge = 'perfect' | 'great' | 'good' | 'miss'

export interface Note {
  lane: number
  time: number // 판정선 도달 시각(초)
  hit: boolean
  judged: Judge | null
}

export interface RhythmState {
  phase: Phase
  time: number
  score: number
  combo: number
  maxCombo: number
  health: number // 0~100
  notes: Note[]
  nextIndex: number // 아직 판정 안 된 가장 이른 노트
  genTime: number // 다음 마디를 만들 시각
  bar: number // 지금까지 만든 마디 수
  counts: Record<Judge, number>
  overTimer: number
}

export const LANES = 4
export const APPROACH = 1.5 // 노트가 화면에 보이는 시간(초)

// 판정 창 (초)
const W_PERFECT = 0.045
const W_GREAT = 0.09
const W_GOOD = 0.15
export const HIT_WINDOW = W_GOOD

const bpmAt = (bar: number) => Math.min(150, 105 + bar * 2)

// 마디 하나를 생성 — 8비트 슬롯, 진행할수록 약박 채움과 동시 노트가 늘어난다
function generateBar(state: RhythmState) {
  const bar = state.bar
  const bpm = bpmAt(bar)
  const beat = 60 / bpm
  const sub = 2
  const slots = sub * 4
  const start = state.genTime
  let lastLane = -1
  for (let s = 0; s < slots; s++) {
    // 강박은 거의 항상, 약박은 확률적으로
    const strong = s % sub === 0
    const chance = strong ? 0.9 : Math.min(0.5, 0.12 + bar * 0.015)
    if (Math.random() > chance) continue
    let lane = Math.floor(Math.random() * LANES)
    if (lane === lastLane) lane = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES
    lastLane = lane
    const time = start + (s * beat * 4) / slots
    state.notes.push({ lane, time, hit: false, judged: null })
    // 후반부엔 가끔 동시 노트
    if (strong && bar >= 8 && Math.random() < 0.18) {
      const other = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES
      state.notes.push({ lane: other, time, hit: false, judged: null })
    }
  }
  state.notes.sort((a, b) => a.time - b.time)
  state.genTime = start + beat * 4
  state.bar += 1
}

export function createState(): RhythmState {
  const state: RhythmState = {
    phase: 'playing',
    time: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    health: 100,
    notes: [],
    nextIndex: 0,
    genTime: 2, // 첫 노트까지 준비 시간
    bar: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    overTimer: 0,
  }
  ensureNotes(state)
  return state
}

export function ensureNotes(state: RhythmState) {
  while (state.genTime < state.time + APPROACH + 4) generateBar(state)
}

const JUDGE_SCORE: Record<Judge, number> = { perfect: 100, great: 60, good: 30, miss: 0 }
const JUDGE_HEALTH: Record<Judge, number> = { perfect: 2, great: 1, good: 0, miss: -12 }

function applyJudge(state: RhythmState, note: Note, judge: Judge) {
  note.hit = true
  note.judged = judge
  state.counts[judge] += 1
  if (judge === 'miss') {
    state.combo = 0
  } else {
    state.combo += 1
    state.maxCombo = Math.max(state.maxCombo, state.combo)
    // 콤보 보너스는 10콤보마다 10%씩, 최대 2배
    const mult = Math.min(2, 1 + Math.floor(state.combo / 10) * 0.1)
    state.score = Math.min(1_000_000, state.score + Math.round(JUDGE_SCORE[judge] * mult))
  }
  state.health = Math.max(0, Math.min(100, state.health + JUDGE_HEALTH[judge]))
  if (state.health <= 0) {
    state.phase = 'over'
    state.overTimer = 0.8
  }
}

// 판정선을 지나친 노트를 miss 처리. 지나간 miss 노트를 돌려준다
export function update(state: RhythmState, dt: number): Judge[] {
  const results: Judge[] = []
  if (state.phase !== 'playing') return results
  state.time += dt
  ensureNotes(state)
  // 지나간 노트가 무한히 쌓이지 않게 잘라낸다
  if (state.nextIndex > 300) {
    state.notes.splice(0, 300)
    state.nextIndex -= 300
  }
  while (state.nextIndex < state.notes.length) {
    const note = state.notes[state.nextIndex]
    if (note.hit) {
      state.nextIndex += 1
      continue
    }
    if (note.time + HIT_WINDOW >= state.time) break
    applyJudge(state, note, 'miss')
    results.push('miss')
    state.nextIndex += 1
  }
  return results
}

// 레인 탭: 판정 창 안에서 가장 가까운 노트를 판정한다
export function tapLane(state: RhythmState, lane: number): Judge | null {
  if (state.phase !== 'playing') return null
  let best: Note | null = null
  let bestDiff = Infinity
  for (let i = state.nextIndex; i < state.notes.length; i++) {
    const note = state.notes[i]
    if (note.time - state.time > HIT_WINDOW) break
    if (note.hit || note.lane !== lane) continue
    const diff = Math.abs(note.time - state.time)
    if (diff < bestDiff) {
      bestDiff = diff
      best = note
    }
  }
  if (!best) return null
  const judge: Judge = bestDiff <= W_PERFECT ? 'perfect' : bestDiff <= W_GREAT ? 'great' : 'good'
  applyJudge(state, best, judge)
  return judge
}
