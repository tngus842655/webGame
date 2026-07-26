// 오목 (AI전) — 15×15 대국. 1단부터 10단까지 올라가는 단 사다리.
// AI는 공격·수비 패턴 점수로 한 수를 고른다. 낮은 단은 일부러 실수하고,
// 6단부터는 내 응수까지 읽는 2수 탐색을 하며 단이 오를수록 더 넓게 본다.

export type Phase = 'playing' | 'aiThinking' | 'won' | 'lost' | 'over'
export type Stone = 0 | 1 | 2 // 0 빈칸, 1 플레이어(흑), 2 AI(백)

export const SIZE = 15
export const MAX_STAGE = 10
export const TIMED_FROM = 6 // 이 단부터 판마다 제한 시간이 붙는다

// 6단 140초 → 10단 60초. 한 판이 대략 45수(내 차례 22수)라
// 10단은 한 수에 3초 남짓밖에 못 쓴다. 시계는 내 차례에만 간다.
export function stageSeconds(stage: number): number {
  return 140 - (stage - TIMED_FROM) * 20
}

// 단 클리어 기본 점수 (단이 오를수록 크게)
export function stagePoints(stage: number): number {
  return 200 + (stage - 1) * 100
}

// 제한 시간이 있는 단은 남긴 시간을 점수로 바꿔준다
export const TIME_BONUS_PER_SEC = 4

export interface OmokState {
  phase: Phase
  board: Stone[] // SIZE*SIZE
  stage: number // 1~10
  cleared: boolean // 10단까지 통과
  timeLeft: number // 제한 시간이 있는 단에서만 > 0
  lastBonus: number // 방금 판에서 받은 시간 보너스 (연출용)
  score: number
  lastMove: number // 마지막 착수 위치 (-1 없음)
  winLine: number[] // 승리한 5목 위치 (연출용)
  moveCount: number
  thinkTimer: number // AI 착수 지연 (생각하는 느낌)
  resultTimer: number // 승/패 연출 후 다음 판/게임오버
  history: number[] // 착수 순서 (무르기용)
}

export function createState(): OmokState {
  return {
    phase: 'playing',
    board: new Array<Stone>(SIZE * SIZE).fill(0),
    stage: 1,
    cleared: false,
    timeLeft: 0,
    lastBonus: 0,
    score: 0,
    lastMove: -1,
    winLine: [],
    moveCount: 0,
    thinkTimer: 0,
    resultTimer: 0,
    history: [],
  }
}

// 다음 단으로 (또는 같은 단을 다시) 시작
export function startStage(state: OmokState, stage: number) {
  state.board.fill(0)
  state.stage = stage
  state.lastMove = -1
  state.winLine = []
  state.moveCount = 0
  state.history = []
  state.timeLeft = stage >= TIMED_FROM ? stageSeconds(stage) : 0
  state.phase = 'playing'
}

// 제한 시간 소진 여부. true면 시간 초과(패배)
export function tickClock(state: OmokState, dt: number): boolean {
  if (state.timeLeft <= 0) return false
  state.timeLeft = Math.max(0, state.timeLeft - dt)
  return state.timeLeft === 0
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

// stone이 (x,y)에 놓였을 때 5목이면 그 줄을 돌려준다
export function findWin(board: Stone[], index: number, stone: Stone): number[] | null {
  const x = index % SIZE
  const y = Math.floor(index / SIZE)
  for (const [dx, dy] of DIRS) {
    const line = [index]
    for (const sign of [1, -1]) {
      for (let k = 1; k < 5; k++) {
        const nx = x + dx * k * sign
        const ny = y + dy * k * sign
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break
        if (board[ny * SIZE + nx] !== stone) break
        line.push(ny * SIZE + nx)
      }
    }
    if (line.length >= 5) return line
  }
  return null
}

// (x,y)에 stone을 놓는다고 가정하고 4방향 패턴 점수를 매긴다
function cellScore(board: Stone[], index: number, stone: Stone): number {
  const x = index % SIZE
  const y = Math.floor(index / SIZE)
  let total = 0
  for (const [dx, dy] of DIRS) {
    let count = 1 // 이 칸 포함 연속 개수
    let openEnds = 0
    for (const sign of [1, -1]) {
      let k = 1
      for (; k < 5; k++) {
        const nx = x + dx * k * sign
        const ny = y + dy * k * sign
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) break
        const cell = board[ny * SIZE + nx]
        if (cell !== stone) {
          if (cell === 0) openEnds += 1
          break
        }
        count += 1
      }
      if (k === 5) openEnds += 1 // 5칸 모두 같은 돌이면 열린 것으로 취급
    }
    if (count >= 5) total += 1_000_000
    else if (count === 4) total += openEnds === 2 ? 120_000 : 12_000
    else if (count === 3) total += openEnds === 2 ? 6_000 : 800
    else if (count === 2) total += openEnds === 2 ? 300 : 40
    else total += openEnds * 5
  }
  return total
}

// 돌 근처 2칸 이내 빈칸 (탐색 후보)
function nearCells(board: Stone[]): number[] {
  const near = new Set<number>()
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) continue
    const x = i % SIZE
    const y = Math.floor(i / SIZE)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue
        const j = ny * SIZE + nx
        if (board[j] === 0) near.add(j)
      }
    }
  }
  return [...near]
}

// 한 수 평가: 내 공격 + 상대 수비
function moveValue(board: Stone[], index: number, stone: Stone): number {
  const foe: Stone = stone === 1 ? 2 : 1
  return cellScore(board, index, stone) + cellScore(board, index, foe) * 0.85
}

// AI 착수. 낮은 단일수록 상위 후보 중에서 흔들려 일부러 실수한다.
// 5단부터는 항상 최선수를 둔다 — 그 위는 AI를 더 강하게 만드는 대신 제한 시간으로 조인다.
// (2수 탐색도 붙여봤지만 서로 완벽히 막기만 해 무승부 100%가 나와 걷어냈다)
export function aiMove(state: OmokState): number {
  const board = state.board
  // 첫 수: 플레이어 근처
  if (state.moveCount === 1) {
    const last = state.lastMove
    const lx = last % SIZE
    const ly = Math.floor(last / SIZE)
    const candidates: number[] = []
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = lx + dx
      const ny = ly + dy
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny * SIZE + nx] === 0) {
        candidates.push(ny * SIZE + nx)
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  const scored = nearCells(board)
    .map((index) => ({ index, score: moveValue(board, index, 2) }))
    .sort((a, b) => b.score - a.score)
  // 판이 꽉 차면 후보가 없다 — 호출부에서 무승부 처리하지만 여기서도 방어한다
  if (scored.length === 0) return board.findIndex((cell) => cell === 0)

  const sloppiness = Math.max(0, 5 - state.stage)
  const pickRange = 1 + (sloppiness > 0 && Math.random() < sloppiness * 0.25 ? sloppiness : 0)
  const pick = scored[Math.floor(Math.random() * Math.min(pickRange, scored.length))]
  return pick.index
}

// 빈칸이 남았는가 (다 차면 아무도 둘 수 없다 — 예전엔 여기서 AI가 크래시했다)
export function boardFull(state: OmokState): boolean {
  return state.moveCount >= SIZE * SIZE
}

export type MoveResult = 'placed' | 'win' | 'invalid'

export function playerMove(state: OmokState, index: number): MoveResult {
  if (state.phase !== 'playing' || state.board[index] !== 0) return 'invalid'
  state.board[index] = 1
  state.lastMove = index
  state.history.push(index)
  state.moveCount += 1
  const line = findWin(state.board, index, 1)
  if (line) {
    state.winLine = line
    state.lastBonus = Math.round(state.timeLeft) * TIME_BONUS_PER_SEC
    state.score = Math.min(1_000_000, state.score + stagePoints(state.stage) + state.lastBonus)
    if (state.stage >= MAX_STAGE) state.cleared = true
    state.phase = 'won'
    state.resultTimer = 2
    return 'win'
  }
  if (boardFull(state)) {
    // 무승부 — 단 통과 실패로 본다
    state.phase = 'lost'
    state.resultTimer = 2
    return 'placed'
  }
  state.phase = 'aiThinking'
  state.thinkTimer = 0.5 + Math.random() * 0.5
  return 'placed'
}

export function applyAiMove(state: OmokState): MoveResult {
  if (boardFull(state)) {
    state.phase = 'lost'
    state.resultTimer = 2
    return 'placed'
  }
  const index = aiMove(state)
  state.board[index] = 2
  state.lastMove = index
  state.history.push(index)
  state.moveCount += 1
  const line = findWin(state.board, index, 2)
  if (line) {
    state.winLine = line
    state.phase = 'lost'
    state.resultTimer = 2
    return 'win'
  }
  // 판이 다 차면 무승부 — 단 통과 실패로 본다
  if (boardFull(state)) {
    state.phase = 'lost'
    state.resultTimer = 2
    return 'win'
  }
  state.phase = 'playing'
  return 'placed'
}

// 무르기: 마지막 AI 수 + 내 수를 되돌린다 (광고 보상)
export function undo(state: OmokState): boolean {
  if (state.phase !== 'playing' || state.history.length < 2) return false
  for (let k = 0; k < 2; k++) {
    const index = state.history.pop()!
    state.board[index] = 0
    state.moveCount -= 1
  }
  state.lastMove = state.history[state.history.length - 1] ?? -1
  return true
}
