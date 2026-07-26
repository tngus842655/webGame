// 리듬 탭 — 4레인으로 떨어지는 노트를 판정선에 맞춰 탭. 곡은 절차적으로 생성한
// 비트 패턴이며, 진행할수록 BPM과 밀도가 오른다. 놓친 노트가 쌓이면 게임 오버.

export type Phase = 'playing' | 'over'
export type Judge = 'perfect' | 'great' | 'good' | 'miss'

export interface Note {
  lane: number
  time: number // 판정선 도달 시각(초)
  hit: boolean
  judged: Judge | null
  window: number // 이 노트의 GOOD 판정 폭 (BPM이 오르면 좁아진다)
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
// 곡의 길이. 끝이 없으면 정확한 사람은 영영 죽지 않아 세션이 늘어지고 점수도 상한까지 부푼다.
// 리듬 게임은 원래 곡이 끝나면 판이 끝난다 — 난이도가 다 오르는 지점(약 2분 반)에 맞췄다.
export const SONG_BARS = 100

// 판정 창 (초). 기준 BPM에서 GOOD ±150ms, GREAT ±90ms, PERFECT ±45ms.
// BPM에 반비례해 좁아진다 — 고정폭이면 190BPM(8비트 간격 158ms)에서 앞뒤 노트의
// 판정 창이 겹쳐서 아무 데나 쳐도 맞았고, 정확한 사람은 영영 죽지 않았다.
export const HIT_WINDOW = 0.15
const BASE_BPM = 105
const windowFor = (bpm: number) => HIT_WINDOW * Math.min(1, BASE_BPM / bpm)

// 예전엔 45초면 BPM·밀도가 전부 상한에 닿아 같은 패턴이 무한 반복됐다.
// 계수를 낮추고 천장을 올려 2분 부근까지 계속 조여든다.
const bpmAt = (bar: number) => Math.min(190, 105 + bar * 1.2)

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
    const chance = strong ? 0.9 : Math.min(0.85, 0.12 + bar * 0.01)
    if (Math.random() > chance) continue
    let lane = Math.floor(Math.random() * LANES)
    if (lane === lastLane) lane = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES
    lastLane = lane
    const time = start + (s * beat * 4) / slots
    const window = windowFor(bpm)
    state.notes.push({ lane, time, hit: false, judged: null, window })
    // 후반부엔 가끔 동시 노트
    if (strong && bar >= 8 && Math.random() < Math.min(0.45, 0.06 + bar * 0.008)) {
      const other = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES
      state.notes.push({ lane: other, time, hit: false, judged: null, window })
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
  while (state.bar < SONG_BARS && state.genTime < state.time + APPROACH + 4) generateBar(state)
}

// 노트가 워낙 많아 다른 게임의 25배로 쌓였다 — 판정당 점수를 낮춰 분당 점수를 맞춘다
const JUDGE_SCORE: Record<Judge, number> = { perfect: 4, great: 2, good: 1, miss: 0 }
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
    if (note.time + note.window >= state.time) break
    applyJudge(state, note, 'miss')
    results.push('miss')
    state.nextIndex += 1
  }
  // 마지막 노트까지 지나가면 곡이 끝난다
  if (state.phase === 'playing' && state.bar >= SONG_BARS && state.nextIndex >= state.notes.length) {
    state.phase = 'over'
    state.overTimer = 0.8
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
    if (diff > note.window) continue
    if (diff < bestDiff) {
      bestDiff = diff
      best = note
    }
  }
  if (!best) return null
  const judge: Judge =
    bestDiff <= best.window * 0.3 ? 'perfect' : bestDiff <= best.window * 0.6 ? 'great' : 'good'
  applyJudge(state, best, judge)
  return judge
}
