// 오목 (AI전) — 15×15 대국. 이길수록 AI가 강해지는 연승 사다리.
// AI는 공격·수비 패턴 점수 휴리스틱으로 한 수를 고른다 (연승이 낮을수록 무작위성 추가).

export type Phase = 'playing' | 'aiThinking' | 'won' | 'lost' | 'over'
export type Stone = 0 | 1 | 2 // 0 빈칸, 1 플레이어(흑), 2 AI(백)

export const SIZE = 15

export interface OmokState {
  phase: Phase
  board: Stone[] // SIZE*SIZE
  wins: number // 연승 = 점수 근거
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
    wins: 0,
    score: 0,
    lastMove: -1,
    winLine: [],
    moveCount: 0,
    thinkTimer: 0,
    resultTimer: 0,
    history: [],
  }
}

export function resetBoard(state: OmokState) {
  state.board.fill(0)
  state.lastMove = -1
  state.winLine = []
  state.moveCount = 0
  state.history = []
  state.phase = 'playing'
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

// AI 착수: 공격 + 수비 점수 최대 칸. 연승이 낮으면 상위 후보 중 무작위
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

  // 돌 근처 2칸 이내 빈칸만 후보로
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

  const scored: Array<{ index: number; score: number }> = []
  for (const index of near) {
    const attack = cellScore(board, index, 2)
    const defense = cellScore(board, index, 1)
    scored.push({ index, score: attack + defense * 0.85 })
  }
  scored.sort((a, b) => b.score - a.score)
  // 연승 0~2는 상위 후보 중 무작위로 실수한다 (사다리 난이도)
  const sloppiness = Math.max(0, 3 - state.wins)
  const pickRange = 1 + (sloppiness > 0 && Math.random() < sloppiness * 0.25 ? sloppiness : 0)
  const pick = scored[Math.floor(Math.random() * Math.min(pickRange, scored.length))]
  return pick.index
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
    state.wins += 1
    state.score = Math.min(1_000_000, state.score + 100 * state.wins)
    state.phase = 'won'
    state.resultTimer = 2
    return 'win'
  }
  state.phase = 'aiThinking'
  state.thinkTimer = 0.5 + Math.random() * 0.5
  return 'placed'
}

export function applyAiMove(state: OmokState): MoveResult {
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
