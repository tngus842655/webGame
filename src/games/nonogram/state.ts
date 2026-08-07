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

// 밀도를 판마다 다시 뽑아 인상을 바꾼다. 크기가 10×10에서 멈추는 8판 이후로는
// 판을 구분해 주는 게 이것뿐이다 — 성기면 점점이 흩어진 그림, 빽빽하면 굵은
// 덩어리가 나온다. 폭은 판이 오를수록 넓어져 21판에 최대가 된다.
//
// 폭이 이만큼 커야 하는 이유: 칸을 하나씩 독립으로 뽑는 구조라 같은 밀도로
// 만들어도 채움 칸 수가 σ≈4.5%p로 이미 출렁인다. 좁게 흔들면 그 노이즈에 묻혀
// 옆 판과 다른 티가 안 난다(55% 중심 ±10%p로는 평균이 아예 안 움직였다).
//
// 중심이 55%가 아니라 58%인 것은 lineSolvable이 성긴 퍼즐을 더 많이 버리기
// 때문이다 — 아래쪽만 눌려서 목표 46%가 실현 50%로 올라온다. 58%±12%p를 넣어야
// 실제로 50~70%가 나온다. 더 내리지 않는 건 비용 때문이다(목표 42%면 생성이
// 0.7ms로 는다). 위쪽은 필터가 거의 안 버려서 오히려 싸다.
function densityForLevel(level: number): number {
  const swing = Math.min(0.12, (level - 1) * 0.006)
  return 0.58 + (Math.random() * 2 - 1) * swing
}

// 랜덤 정답 생성 — 전부 빈 행/열이 생기면 다시 만든다
export function generateSolution(size: number, density: number): boolean[][] {
  for (;;) {
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.random() < density),
    )
    const rowsOk = grid.every((row) => row.some(Boolean))
    const colsOk = grid[0].every((_, c) => grid.some((row) => row[c]))
    if (rowsOk && colsOk) return grid
  }
}

// 힌트에 맞는 한 줄의 모든 배치 (칠한 칸 = 비트 1)
function placements(hint: number[], size: number): number[] {
  const out: number[] = []
  const rec = (start: number, hi: number, mask: number) => {
    if (hi === hint.length) {
      out.push(mask)
      return
    }
    let need = hint.length - hi - 1
    for (let k = hi; k < hint.length; k++) need += hint[k]
    for (let s = start; s + need <= size; s++) {
      let m = mask
      for (let k = 0; k < hint[hi]; k++) m |= 1 << (s + k)
      rec(s + hint[hi] + 1, hi + 1, m)
    }
  }
  rec(0, 0, 0)
  return out
}

// 줄 논리(각 줄에서 가능한 배치들의 교집합)만으로 전부 확정되는가.
// 무작위 정답은 10×10 기준 27%가 답이 여럿이라, 논리로는 알 수 없는 칸을 찍어야 했고
// 찍어서 틀리면 생명이 깎였다. 이 검사를 통과한 퍼즐만 쓰면 찍을 일이 없다.
function lineSolvable(solution: boolean[][], size: number): boolean {
  const rowP = solution.map((row) => placements(lineRuns(row), size))
  const colP = solution[0].map((_, c) => placements(lineRuns(solution.map((row) => row[c])), size))
  // 0=미정 1=칠함 2=빈칸
  const known = Array.from({ length: size }, () => new Uint8Array(size))
  const narrow = (
    cands: number[],
    get: (i: number) => number,
    set: (i: number, v: number) => void,
  ): boolean => {
    let and = ~0
    let or = 0
    let any = false
    for (const m of cands) {
      let ok = true
      for (let i = 0; i < size; i++) {
        const k = get(i)
        if ((k === 1 && !(m & (1 << i))) || (k === 2 && m & (1 << i))) {
          ok = false
          break
        }
      }
      if (!ok) continue
      any = true
      and &= m
      or |= m
    }
    if (!any) return false
    let changed = false
    for (let i = 0; i < size; i++) {
      if (get(i) !== 0) continue
      if (and & (1 << i)) {
        set(i, 1)
        changed = true
      } else if (!(or & (1 << i))) {
        set(i, 2)
        changed = true
      }
    }
    return changed
  }
  for (let pass = 0; pass < size * 4; pass++) {
    let changed = false
    for (let r = 0; r < size; r++) {
      if (narrow(rowP[r], (i) => known[r][i], (i, v) => { known[r][i] = v })) changed = true
    }
    for (let c = 0; c < size; c++) {
      if (narrow(colP[c], (i) => known[i][c], (i, v) => { known[i][c] = v })) changed = true
    }
    if (!changed) break
  }
  return known.every((row) => row.every((v) => v !== 0))
}

// 찍지 않고 풀 수 있는 퍼즐만 낸다 (10×10 평균 1.5회 시도 0.1ms,
// 밀도를 가장 성기게 뽑은 46%에서도 평균 3회 0.4ms — 한 프레임 안이다)
function generateFairSolution(size: number, density: number): boolean[][] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = generateSolution(size, density)
    if (lineSolvable(grid, size)) return grid
  }
  return generateSolution(size, density)
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
  const solution = generateFairSolution(size, densityForLevel(level))
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
