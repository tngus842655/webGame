// 보석 매치3 로직 — 보드 생성·매치 판정·낙하/보충·가능한 수 탐색

import {
  CELL,
  COLS,
  FIRST_GOAL,
  GEMS,
  LEVEL_MOVES,
  MAX_SCORE,
  ROWS,
  START_MOVES,
} from './config'

export type Phase = 'idle' | 'swap' | 'revert' | 'fall' | 'over'

export interface Pos {
  col: number
  row: number
}

// type: GEMS 인덱스, -1 = 빈칸. offsetY: 낙하 연출용 세로 오프셋(px, 0으로 수렴)
export interface Cell {
  type: number
  offsetY: number
}

export interface Popup {
  x: number
  y: number
  text: string
  age: number
}

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  color: string
}

export const POPUP_DURATION = 0.8
export const SPARK_DURATION = 0.5

export interface M3State {
  phase: Phase
  grid: Cell[]
  score: number
  level: number
  goal: number
  goalBase: number // 현재 레벨 시작 시점의 목표 (진행 바 기준점)
  moves: number
  chain: number // 연쇄 배수 (1부터)
  selected: Pos | null
  swap: { a: Pos; b: Pos; t: number } | null
  playTime: number // 선택 강조·힌트 애니메이션용
  levelFx: number // 레벨업 배너 경과 시간 (큰 값 = 표시 안 함)
  popups: Popup[]
  sparks: Spark[]
}

export const idx = (col: number, row: number) => row * COLS + col

const randType = () => Math.floor(Math.random() * GEMS.length)

export const gridTypes = (grid: Cell[]) => grid.map((cell) => cell.type)

// 왼쪽·위쪽 2칸과 3연속이 되지 않는 타입 선택 (초기 보드용)
function pickNoMatch(types: number[], col: number, row: number): number {
  for (;;) {
    const t = randType()
    if (col >= 2 && types[idx(col - 1, row)] === t && types[idx(col - 2, row)] === t) continue
    if (row >= 2 && types[idx(col, row - 1)] === t && types[idx(col, row - 2)] === t) continue
    return t
  }
}

// 초기 매치 없음 + 가능한 수 1개 이상 보장
export function createGrid(): Cell[] {
  for (;;) {
    const types = new Array<number>(COLS * ROWS)
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) types[idx(col, row)] = pickNoMatch(types, col, row)
    }
    if (hasPossibleMove(types)) return types.map((type) => ({ type, offsetY: 0 }))
  }
}

export function createState(): M3State {
  return {
    phase: 'idle',
    grid: createGrid(),
    score: 0,
    level: 1,
    goal: FIRST_GOAL,
    goalBase: 0,
    moves: START_MOVES,
    chain: 0,
    selected: null,
    swap: null,
    playTime: 0,
    levelFx: 99,
    popups: [],
    sparks: [],
  }
}

// 가로/세로 3개 이상 동일 보석의 셀 인덱스 집합
export function findMatches(types: number[]): Set<number> {
  const out = new Set<number>()
  for (let row = 0; row < ROWS; row++) {
    let run = 1
    for (let col = 1; col <= COLS; col++) {
      const same =
        col < COLS && types[idx(col, row)] >= 0 && types[idx(col, row)] === types[idx(col - 1, row)]
      if (same) {
        run += 1
      } else {
        if (run >= 3) for (let k = col - run; k < col; k++) out.add(idx(k, row))
        run = 1
      }
    }
  }
  for (let col = 0; col < COLS; col++) {
    let run = 1
    for (let row = 1; row <= ROWS; row++) {
      const same =
        row < ROWS && types[idx(col, row)] >= 0 && types[idx(col, row)] === types[idx(col, row - 1)]
      if (same) {
        run += 1
      } else {
        if (run >= 3) for (let k = row - run; k < row; k++) out.add(idx(col, k))
        run = 1
      }
    }
  }
  return out
}

// 인접 스왑으로 매치를 만들 수 있는지
export function hasPossibleMove(types: number[]): boolean {
  const makesMatch = (a: number, b: number): boolean => {
    const tmp = types[a]
    types[a] = types[b]
    types[b] = tmp
    const ok = findMatches(types).size > 0
    types[b] = types[a]
    types[a] = tmp
    return ok
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (col + 1 < COLS && makesMatch(idx(col, row), idx(col + 1, row))) return true
      if (row + 1 < ROWS && makesMatch(idx(col, row), idx(col, row + 1))) return true
    }
  }
  return false
}

// 가능한 수가 없을 때: 기존 보석을 섞어 매치 없음 + 가능한 수 보장
export function shuffleGrid(grid: Cell[]) {
  const types = gridTypes(grid)
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = types[i]
      types[i] = types[j]
      types[j] = tmp
    }
    if (findMatches(types).size === 0 && hasPossibleMove(types)) {
      grid.forEach((cell, i) => {
        cell.type = types[i]
        cell.offsetY = 0
      })
      return
    }
  }
  // 극히 드문 셔플 실패 시 새 보드로 대체
  const fresh = createGrid()
  grid.forEach((cell, i) => {
    cell.type = fresh[i].type
    cell.offsetY = 0
  })
}

export function swapCells(grid: Cell[], a: Pos, b: Pos) {
  const i = idx(a.col, a.row)
  const j = idx(b.col, b.row)
  const tmp = grid[i].type
  grid[i].type = grid[j].type
  grid[j].type = tmp
}

// 빈칸 위 보석을 내리고 상단에 새 보석 보충 (offsetY로 낙하 연출)
export function applyGravity(grid: Cell[]) {
  for (let col = 0; col < COLS; col++) {
    let write = ROWS - 1
    for (let row = ROWS - 1; row >= 0; row--) {
      const cell = grid[idx(col, row)]
      if (cell.type < 0) continue
      if (write !== row) {
        const target = grid[idx(col, write)]
        target.type = cell.type
        target.offsetY = cell.offsetY - (write - row) * CELL
        cell.type = -1
      }
      write -= 1
    }
    // 새 보석은 보드 위쪽에서 등장 (기존 간격 유지)
    const newCount = write + 1
    for (let row = write; row >= 0; row--) {
      const cell = grid[idx(col, row)]
      cell.type = randType()
      cell.offsetY = -newCount * CELL
    }
  }
}

// 점수 반영 + 목표 도달 시 레벨업 (이동 +10, 목표 += 1000 + 새 레벨×500)
export function addScore(state: M3State, gained: number) {
  state.score = Math.min(MAX_SCORE, state.score + gained)
  while (state.score >= state.goal) {
    state.level += 1
    state.moves += LEVEL_MOVES
    state.goalBase = state.goal
    // 이동 보상은 레벨당 +10회로 고정인데 목표는 레벨당 +500씩 더 올라서
    // 레벨 2를 넘기는 게 사실상 불가능했다. 이동 보상에 맞춰 완만하게 올린다.
    state.goal += 700 + state.level * 100
    state.levelFx = 0
  }
}

export function updateEffects(state: M3State, dt: number) {
  state.playTime += dt
  state.levelFx += dt
  for (const p of state.popups) {
    p.age += dt
    p.y -= 70 * dt
  }
  for (const s of state.sparks) {
    s.age += dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vy += 900 * dt
  }
  state.popups = state.popups.filter((p) => p.age < POPUP_DURATION)
  state.sparks = state.sparks.filter((s) => s.age < SPARK_DURATION)
}
