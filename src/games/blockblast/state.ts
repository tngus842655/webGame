import { COLORS, GRID, LAYOUT, SCORING, SHAPES, type PieceShape } from './config'

export type Phase = 'playing' | 'over'

export interface Piece {
  shape: PieceShape
  color: number // COLORS 인덱스
}

export interface Popup {
  x: number
  y: number
  text: string
  age: number
}

export interface ClearFx {
  col: number
  row: number
  color: number
  age: number
}

export const POPUP_DURATION = 0.8
export const CLEAR_FX_DURATION = 0.35

export interface BBState {
  phase: Phase
  score: number
  grid: number[] // GRID×GRID, 0=빈칸, n>0 = COLORS[n-1]
  tray: (Piece | null)[]
  streak: number
  streakAge: number // 콤보 배지 팝 연출용
  streakGrace: number // 남은 콤보 유예 — 줄을 못 지운 배치를 한 번은 버틴다
  popups: Popup[]
  clearFx: ClearFx[]
  placedOnce: boolean // 첫 플레이 힌트용
  hintTime: number // 힌트·강조 애니메이션 시간
}

function randomFrom(shapes: PieceShape[]): Piece {
  const total = shapes.reduce((sum, s) => sum + s.weight, 0)
  let r = Math.random() * total
  let picked = shapes[0]
  for (const s of shapes) {
    r -= s.weight
    if (r < 0) {
      picked = s
      break
    }
  }
  return { shape: picked, color: Math.floor(Math.random() * COLORS.length) }
}

export function createState(): BBState {
  return {
    phase: 'playing',
    score: 0,
    grid: new Array<number>(GRID * GRID).fill(0),
    tray: [randomFrom(SHAPES), randomFrom(SHAPES), randomFrom(SHAPES)],
    streak: 0,
    streakAge: 0,
    streakGrace: 0,
    popups: [],
    clearFx: [],
    placedOnce: false,
    hintTime: 0,
  }
}

// 광고 보상: 1×1 포함 소형(≤3칸) 블록으로 교체 — 보드가 꽉 차 있을 수 없으므로
// (꽉 찬 줄은 즉시 지워진다) 1×1은 항상 놓을 수 있다
export function replaceTrayWithSmall(state: BBState) {
  const smalls = SHAPES.filter((s) => s.cells.length <= 3)
  state.tray = [randomFrom([SHAPES[0]]), randomFrom(smalls), randomFrom(smalls)]
}

export function pieceSize(piece: Piece): { w: number; h: number } {
  let w = 0
  let h = 0
  for (const [dx, dy] of piece.shape.cells) {
    w = Math.max(w, dx + 1)
    h = Math.max(h, dy + 1)
  }
  return { w, h }
}

export function fits(grid: number[], piece: Piece, col: number, row: number): boolean {
  for (const [dx, dy] of piece.shape.cells) {
    const x = col + dx
    const y = row + dy
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return false
    if (grid[y * GRID + x] !== 0) return false
  }
  return true
}

function anyFit(grid: number[], piece: Piece): boolean {
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (fits(grid, piece, col, row)) return true
    }
  }
  return false
}

function fullLines(grid: number[]): { rows: number[]; cols: number[] } {
  const rows: number[] = []
  const cols: number[] = []
  for (let r = 0; r < GRID; r++) {
    let full = true
    for (let c = 0; c < GRID; c++) {
      if (grid[r * GRID + c] === 0) {
        full = false
        break
      }
    }
    if (full) rows.push(r)
  }
  for (let c = 0; c < GRID; c++) {
    let full = true
    for (let r = 0; r < GRID; r++) {
      if (grid[r * GRID + c] === 0) {
        full = false
        break
      }
    }
    if (full) cols.push(c)
  }
  return { rows, cols }
}

// 고스트 미리보기용: 이 위치에 놓으면 완성되는 줄
export function previewClears(
  grid: number[],
  piece: Piece,
  col: number,
  row: number,
): { rows: number[]; cols: number[] } {
  const g = grid.slice()
  for (const [dx, dy] of piece.shape.cells) g[(row + dy) * GRID + (col + dx)] = 1
  return fullLines(g)
}

// 드래그 좌표 → 스냅될 보드 칸 (블록은 손가락 위로 dragLift만큼 떠 있다)
export function dragTarget(piece: Piece, x: number, y: number): { col: number; row: number } {
  const { w, h } = pieceSize(piece)
  const originX = x - (w * LAYOUT.cell) / 2
  const originY = y - LAYOUT.dragLift - (h * LAYOUT.cell) / 2
  return {
    col: Math.round((originX - LAYOUT.boardX) / LAYOUT.cell),
    row: Math.round((originY - LAYOUT.boardY) / LAYOUT.cell),
  }
}

export interface PlaceResult {
  gained: number
  linesCleared: number
  clearedCells: Array<{ col: number; row: number; color: number }>
  allClear: boolean // 이 배치로 보드가 완전히 비었다
  gameOver: boolean
}

export function placePiece(
  state: BBState,
  trayIndex: number,
  col: number,
  row: number,
): PlaceResult | null {
  const piece = state.tray[trayIndex]
  if (!piece || state.phase !== 'playing' || !fits(state.grid, piece, col, row)) return null

  for (const [dx, dy] of piece.shape.cells) {
    state.grid[(row + dy) * GRID + (col + dx)] = piece.color + 1
  }
  state.tray[trayIndex] = null
  state.placedOnce = true

  const { rows, cols } = fullLines(state.grid)
  const clearedCells: PlaceResult['clearedCells'] = []
  const seen = new Set<number>()
  const collect = (idx: number, cellCol: number, cellRow: number) => {
    if (seen.has(idx)) return
    seen.add(idx)
    clearedCells.push({ col: cellCol, row: cellRow, color: state.grid[idx] - 1 })
  }
  for (const r of rows) for (let x = 0; x < GRID; x++) collect(r * GRID + x, x, r)
  for (const c of cols) for (let y = 0; y < GRID; y++) collect(y * GRID + c, c, y)
  for (const cell of clearedCells) state.grid[cell.row * GRID + cell.col] = 0

  const lines = rows.length + cols.length
  let gained = SCORING.perCell * piece.shape.cells.length
  let allClear = false
  if (lines > 0) {
    state.streak += 1
    state.streakAge = 0
    state.streakGrace = 1
    gained += SCORING.lineBase * lines * lines + (state.streak - 1) * SCORING.streakBonus
    if (state.grid.every((v) => v === 0)) {
      allClear = true
      gained += SCORING.allClear
    }
  } else if (state.streakGrace > 0) {
    state.streakGrace -= 1 // 콤보 유예: 줄을 못 지운 배치 한 번은 콤보가 버틴다
  } else {
    state.streak = 0
  }
  state.score += gained

  if (state.tray.every((p) => p === null)) {
    state.tray = [randomFrom(SHAPES), randomFrom(SHAPES), randomFrom(SHAPES)]
  }
  const remaining = state.tray.filter((p): p is Piece => p !== null)
  const gameOver = !remaining.some((p) => anyFit(state.grid, p))
  if (gameOver) state.phase = 'over'

  return { gained, linesCleared: lines, clearedCells, allClear, gameOver }
}

export function updateEffects(state: BBState, dt: number) {
  state.hintTime += dt
  state.streakAge += dt
  for (const p of state.popups) {
    p.age += dt
    p.y -= 60 * dt
  }
  for (const fx of state.clearFx) fx.age += dt
  state.popups = state.popups.filter((p) => p.age < POPUP_DURATION)
  state.clearFx = state.clearFx.filter((fx) => fx.age < CLEAR_FX_DURATION)
}
