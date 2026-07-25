// 네모로직(노노그램) — 힌트 숫자에 맞게 칸을 칠해 숨은 그림을 완성하는 퍼즐

export type CellState = 0 | 1 | 2 // 0=빈칸, 1=칠함, 2=X 표시
export type Phase = 'playing' | 'clearing' | 'over'
export type Mode = 'fill' | 'mark'

export interface NonoState {
  phase: Phase
  mode: Mode
  level: number // 퍼즐 번호 (1부터)
  score: number
  lives: number
  size: number
  solution: boolean[][]
  cells: CellState[][]
  rowHints: number[][]
  colHints: number[][]
  rowDone: boolean[]
  colDone: boolean[]
  remaining: number // 아직 칠하지 않은 정답 셀 수
  clearTimer: number // 완성 연출 후 다음 퍼즐로
  overTimer: number // 마지막 오답 연출 후 게임오버로
  shakeTime: number // 오답 시 그리드 흔들림
  playTime: number
}

export function sizeForLevel(level: number): number {
  if (level <= 3) return 5
  if (level <= 7) return 8
  return 10
}

export function puzzlePoints(size: number): number {
  return size === 5 ? 500 : size === 8 ? 1000 : 1500
}

// 랜덤 정답 생성 (밀도 약 55%) — 전부 빈 행/열이 생기면 다시 만든다
export function generateSolution(size: number): boolean[][] {
  for (;;) {
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.random() < 0.55),
    )
    const rowsOk = grid.every((row) => row.some(Boolean))
    const colsOk = grid[0].every((_, c) => grid.some((row) => row[c]))
    if (rowsOk && colsOk) return grid
  }
}

// 한 줄의 연속 칠 구간 길이 목록
function lineRuns(line: boolean[]): number[] {
  const runs: number[] = []
  let run = 0
  for (const on of line) {
    if (on) {
      run += 1
    } else if (run > 0) {
      runs.push(run)
      run = 0
    }
  }
  if (run > 0) runs.push(run)
  return runs
}

function sameRuns(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}

export function loadPuzzle(state: NonoState, level: number) {
  const size = sizeForLevel(level)
  const solution = generateSolution(size)
  state.level = level
  state.size = size
  state.solution = solution
  state.cells = Array.from({ length: size }, () => Array<CellState>(size).fill(0))
  state.rowHints = solution.map((row) => lineRuns(row))
  state.colHints = solution[0].map((_, c) => lineRuns(solution.map((row) => row[c])))
  state.rowDone = Array<boolean>(size).fill(false)
  state.colDone = Array<boolean>(size).fill(false)
  state.remaining = solution.flat().filter(Boolean).length
  state.lives = 3
  state.clearTimer = 0
}

export function createState(): NonoState {
  const state: NonoState = {
    phase: 'playing',
    mode: 'fill',
    level: 1,
    score: 0,
    lives: 3,
    size: 5,
    solution: [],
    cells: [],
    rowHints: [],
    colHints: [],
    rowDone: [],
    colDone: [],
    remaining: 0,
    clearTimer: 0,
    overTimer: 0,
    shakeTime: 0,
    playTime: 0,
  }
  loadPuzzle(state, 1)
  return state
}

// 해당 행/열이 힌트를 정확히 만족하는지 갱신 (칠해진 셀 기준)
function updateLineDone(state: NonoState, row: number, col: number) {
  state.rowDone[row] = sameRuns(
    lineRuns(state.cells[row].map((v) => v === 1)),
    state.rowHints[row],
  )
  state.colDone[col] = sameRuns(
    lineRuns(state.cells.map((r) => r[col] === 1)),
    state.colHints[col],
  )
}

export type FillResult = 'filled' | 'miss' | 'none'

// 칠하기 시도: 정답이면 칠하고, 오답이면 자동으로 X 표시 (생명 처리는 호출부)
export function applyFill(state: NonoState, row: number, col: number): FillResult {
  if (state.cells[row][col] !== 0) return 'none'
  if (state.solution[row][col]) {
    state.cells[row][col] = 1
    state.remaining -= 1
    updateLineDone(state, row, col)
    return 'filled'
  }
  state.cells[row][col] = 2
  return 'miss'
}

// X 표시 토글 — 칠해진 셀은 변경 불가. 적용된 값(2 또는 0)을 돌려준다
export function toggleMark(state: NonoState, row: number, col: number): CellState | null {
  const cur = state.cells[row][col]
  if (cur === 1) return null
  state.cells[row][col] = cur === 2 ? 0 : 2
  return state.cells[row][col]
}
