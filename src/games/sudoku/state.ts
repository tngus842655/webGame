// 스도쿠 데일리 — 날짜 시드로 모두에게 같은 퍼즐 + 연속 클리어 스트릭.
// 데일리를 풀고 나면 랜덤 연습 퍼즐로 계속 이어진다.

export type Phase = 'playing' | 'clearing' | 'over'

export interface SudokuState {
  phase: Phase
  daily: boolean // 현재 퍼즐이 오늘의 데일리인지
  level: number // 연습 퍼즐 번호 (데일리 다음부터 1, 2, …)
  score: number
  lives: number
  givens: boolean[] // 81
  cells: number[] // 81, 0 = 빈칸
  notes: number[] // 81, 메모한 숫자의 비트마스크 (1 << d)
  memo: boolean // 숫자 패드가 메모를 적는 모드인지
  solution: number[] // 81
  selected: number // -1 = 선택 없음
  counts: number[] // [1..9] 아직 채워야 할 개수
  remaining: number
  elapsed: number // 현재 퍼즐 경과 시간 (시간 보너스 근거)
  clearTimer: number
  overTimer: number
  shakeTime: number
  playTime: number
}

// ── 시드 난수 ───────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── 데일리 날짜·스트릭 (localStorage) ───────────────────────

const STORE_KEY = 'webgame:sudoku-daily'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

function loadStore(): { date: string; streak: number } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date?: string; streak?: number }
    if (typeof parsed.date !== 'string' || typeof parsed.streak !== 'number') return null
    return { date: parsed.date, streak: parsed.streak }
  } catch {
    return null
  }
}

// 이어지고 있는 스트릭 (마지막 클리어가 오늘·어제가 아니면 끊긴 것)
export function currentStreak(): number {
  const info = loadStore()
  if (!info) return 0
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (info.date === todayKey() || info.date === dateKey(yesterday)) return info.streak
  return 0
}

// 오늘 데일리 클리어 기록. 갱신된 스트릭과 오늘 첫 클리어 여부를 돌려준다
export function recordDailyClear(): { streak: number; first: boolean } {
  const info = loadStore()
  const today = todayKey()
  if (info?.date === today) return { streak: info.streak, first: false }
  const streak = currentStreak() + 1
  localStorage.setItem(STORE_KEY, JSON.stringify({ date: today, streak }))
  return { streak, first: true }
}

// ── 퍼즐 생성 ───────────────────────────────────────────────

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)

// 백트래킹으로 완성 해답 생성
function generateSolution(rng: () => number): number[] {
  const cells = new Array<number>(81).fill(0)
  const rows = new Array<number>(9).fill(0)
  const cols = new Array<number>(9).fill(0)
  const boxes = new Array<number>(9).fill(0)

  const fill = (i: number): boolean => {
    if (i === 81) return true
    const r = Math.floor(i / 9)
    const c = i % 9
    const b = boxOf(i)
    for (const d of shuffled(DIGITS, rng)) {
      const bit = 1 << d
      if ((rows[r] | cols[c] | boxes[b]) & bit) continue
      cells[i] = d
      rows[r] |= bit
      cols[c] |= bit
      boxes[b] |= bit
      if (fill(i + 1)) return true
      cells[i] = 0
      rows[r] &= ~bit
      cols[c] &= ~bit
      boxes[b] &= ~bit
    }
    return false
  }
  fill(0)
  return cells
}

// 해답 개수 세기 (limit에서 조기 종료) — 유일해 유지 판정용
function countSolutions(cells: number[], limit: number): number {
  const rows = new Array<number>(9).fill(0)
  const cols = new Array<number>(9).fill(0)
  const boxes = new Array<number>(9).fill(0)
  const empties: number[] = []
  for (let i = 0; i < 81; i++) {
    const d = cells[i]
    if (d === 0) {
      empties.push(i)
    } else {
      const bit = 1 << d
      rows[Math.floor(i / 9)] |= bit
      cols[i % 9] |= bit
      boxes[boxOf(i)] |= bit
    }
  }

  let count = 0
  const dfs = () => {
    if (count >= limit) return
    // 후보가 가장 적은 빈칸부터 (탐색 폭발 방지)
    let bestIdx = -1
    let bestMask = 0
    let bestN = 10
    for (let k = 0; k < empties.length; k++) {
      const i = empties[k]
      if (cells[i] !== 0) continue
      const used = rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]
      let n = 0
      let mask = 0
      for (let d = 1; d <= 9; d++) {
        if (!(used & (1 << d))) {
          n++
          mask |= 1 << d
        }
      }
      if (n === 0) return
      if (n < bestN) {
        bestN = n
        bestIdx = i
        bestMask = mask
        if (n === 1) break
      }
    }
    if (bestIdx === -1) {
      count++
      return
    }
    const r = Math.floor(bestIdx / 9)
    const c = bestIdx % 9
    const b = boxOf(bestIdx)
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      if (!(bestMask & bit)) continue
      cells[bestIdx] = d
      rows[r] |= bit
      cols[c] |= bit
      boxes[b] |= bit
      dfs()
      cells[bestIdx] = 0
      rows[r] &= ~bit
      cols[c] &= ~bit
      boxes[b] &= ~bit
      if (count >= limit) return
    }
  }
  dfs()
  return count
}

// 유일해를 유지하면서 최대 holes개 파낸다
export function generatePuzzle(seed: number, holes = 46): { puzzle: number[]; solution: number[] } {
  const rng = mulberry32(seed)
  const solution = generateSolution(rng)
  const puzzle = solution.slice()
  let removed = 0
  for (const i of shuffled(Array.from({ length: 81 }, (_, k) => k), rng)) {
    if (removed >= holes) break
    const saved = puzzle[i]
    puzzle[i] = 0
    if (countSolutions(puzzle.slice(), 2) === 1) {
      removed++
    } else {
      puzzle[i] = saved
    }
  }
  return { puzzle, solution }
}

export function dailySeed(): number {
  // 같은 날짜 = 같은 시드 (기기 시간대 기준)
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// ── 상태 ────────────────────────────────────────────────────

function applyPuzzle(state: SudokuState, puzzle: number[], solution: number[]) {
  state.givens = puzzle.map((d) => d !== 0)
  state.cells = puzzle.slice()
  state.notes = new Array<number>(81).fill(0)
  state.solution = solution
  state.selected = -1
  state.counts = new Array<number>(10).fill(0)
  state.remaining = 0
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] === 0) {
      state.counts[solution[i]]++
      state.remaining++
    }
  }
  state.lives = 3
  state.elapsed = 0
  state.clearTimer = 0
}

export function loadDaily(state: SudokuState) {
  const { puzzle, solution } = generatePuzzle(dailySeed())
  state.daily = true
  state.level = 0
  applyPuzzle(state, puzzle, solution)
}

export function loadPractice(state: SudokuState, level: number) {
  // 연습 퍼즐이 매번 같은 난이도라 몇 판을 풀든 똑같았다. 레벨마다 빈칸을 늘린다
  // (생성기가 유일해를 확인하므로 지나치게 파낼 걱정은 없다)
  const holes = 46 + Math.min(12, level)
  const { puzzle, solution } = generatePuzzle(Math.floor(Math.random() * 0x7fffffff), holes)
  state.daily = false
  state.level = level
  applyPuzzle(state, puzzle, solution)
}

export function createState(): SudokuState {
  const state: SudokuState = {
    phase: 'playing',
    daily: true,
    level: 0,
    score: 0,
    lives: 3,
    givens: [],
    cells: [],
    notes: [],
    memo: false,
    solution: [],
    selected: -1,
    counts: [],
    remaining: 0,
    elapsed: 0,
    clearTimer: 0,
    overTimer: 0,
    shakeTime: 0,
    playTime: 0,
  }
  loadDaily(state)
  return state
}

export type PlaceResult = 'placed' | 'miss' | 'none'

// 선택된 칸에 숫자 놓기 시도 — 정답만 들어가고 오답은 생명 차감(호출부 처리)
export function placeDigit(state: SudokuState, digit: number): PlaceResult {
  const i = state.selected
  if (i < 0 || state.cells[i] !== 0 || state.counts[digit] <= 0) return 'none'
  if (state.solution[i] === digit) {
    state.cells[i] = digit
    state.notes[i] = 0
    state.counts[digit]--
    state.remaining--
    // 같은 줄·같은 박스에 적어 둔 같은 숫자 메모는 이제 틀린 메모다. 손으로 지우게
    // 두면 메모를 쓸수록 손이 더 바빠진다
    const bit = 1 << digit
    const r = Math.floor(i / 9)
    const c = i % 9
    const b = boxOf(i)
    for (let k = 0; k < 81; k++) {
      if (Math.floor(k / 9) === r || k % 9 === c || boxOf(k) === b) state.notes[k] &= ~bit
    }
    return 'placed'
  }
  return 'miss'
}

// 메모 모드에서 선택한 빈칸에 숫자를 적었다 지웠다 한다
export function toggleNote(state: SudokuState, digit: number): boolean {
  const i = state.selected
  if (i < 0 || state.cells[i] !== 0 || state.counts[digit] <= 0) return false
  state.notes[i] ^= 1 << digit
  return true
}

// 퍼즐 클리어 점수: 기본 + 남은 생명 + 시간 보너스
export function clearPoints(state: SudokuState): number {
  const timeBonus = Math.max(0, 2300 - Math.floor(state.elapsed) * 5)
  return 2600 + state.lives * 520 + timeBonus
}
