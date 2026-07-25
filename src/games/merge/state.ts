// 머지 게임 — 생성 버튼으로 아이템을 만들고, 같은 레벨끼리 합쳐 진화

export const COLS = 5
export const ROWS = 7
export const GEN_COOLDOWN = 0.8

// 아이템 단계 수 (그림은 plantArt.ts)
export const MAX_LEVEL = 12

export const LAYOUT = {
  width: 720,
  height: 1280,
  boardX: 45,
  boardY: 200,
  cell: 126,
  gap: 6,
  genButton: { x: 210, y: 1120, w: 300, h: 110 },
} as const

export function cellPos(col: number, row: number): [number, number] {
  return [
    LAYOUT.boardX + col * LAYOUT.cell + LAYOUT.gap,
    LAYOUT.boardY + row * LAYOUT.cell + LAYOUT.gap,
  ]
}

export type Phase = 'playing' | 'over'

export interface Item {
  level: number // 1부터, ITEMS 인덱스는 level-1
  pop: number
}

export interface MergeState {
  phase: Phase
  score: number
  grid: (Item | null)[]
  genCooldown: number
  hintTime: number // 조작 힌트 애니메이션용
  movedOnce: boolean // 아이템을 한 번이라도 옮겼는지 (힌트 종료 조건)
  discovered: number // 지금까지 만든 최고 레벨
}

export function createState(): MergeState {
  return {
    phase: 'playing',
    score: 0,
    grid: new Array<Item | null>(COLS * ROWS).fill(null),
    genCooldown: 0,
    hintTime: 0,
    movedOnce: false,
    discovered: 1,
  }
}

function emptyIndices(grid: (Item | null)[]): number[] {
  const out: number[] = []
  for (let i = 0; i < grid.length; i++) if (grid[i] === null) out.push(i)
  return out
}

function hasMergePair(grid: (Item | null)[]): boolean {
  const seen = new Set<number>()
  for (const item of grid) {
    if (!item) continue
    if (seen.has(item.level)) return true
    seen.add(item.level)
  }
  return false
}

function checkGameOver(state: MergeState): boolean {
  if (emptyIndices(state.grid).length === 0 && !hasMergePair(state.grid)) {
    state.phase = 'over'
    return true
  }
  return false
}

export interface GenerateResult {
  ok: boolean
  gameOver: boolean
}

export function generate(state: MergeState): GenerateResult {
  if (state.phase !== 'playing' || state.genCooldown > 0) return { ok: false, gameOver: false }
  const empty = emptyIndices(state.grid)
  if (empty.length === 0) return { ok: false, gameOver: false }
  const idx = empty[Math.floor(Math.random() * empty.length)]
  state.grid[idx] = { level: Math.random() < 0.2 ? 2 : 1, pop: 1 }
  state.genCooldown = GEN_COOLDOWN
  return { ok: true, gameOver: checkGameOver(state) }
}

export interface DropResult {
  merged: boolean
  newLevel: number
  gameOver: boolean
}

// from의 아이템을 to 칸에 놓는다 (합체/이동/실패)
export function dropItem(state: MergeState, from: number, to: number): DropResult {
  const result: DropResult = { merged: false, newLevel: 0, gameOver: false }
  const item = state.grid[from]
  if (!item || from === to || state.phase !== 'playing') return result
  const target = state.grid[to]

  if (target === null) {
    state.grid[to] = item
    state.grid[from] = null
    state.movedOnce = true
    return result
  }
  if (target.level === item.level && item.level < MAX_LEVEL) {
    const newLevel = item.level + 1
    state.grid[to] = { level: newLevel, pop: 1 }
    state.grid[from] = null
    state.score += 2 ** newLevel
    state.discovered = Math.max(state.discovered, newLevel)
    state.movedOnce = true
    result.merged = true
    result.newLevel = newLevel
    result.gameOver = checkGameOver(state)
  }
  return result
}

// 광고 보상: 보드에서 가장 낮은 레벨 아이템들을 제거해 공간 확보
export function clearLowestItems(state: MergeState) {
  let lowest = Infinity
  for (const item of state.grid) if (item) lowest = Math.min(lowest, item.level)
  if (!Number.isFinite(lowest)) return
  for (let i = 0; i < state.grid.length; i++) {
    if (state.grid[i]?.level === lowest) state.grid[i] = null
  }
}

export function updateEffects(state: MergeState, dt: number) {
  state.hintTime += dt
  for (const item of state.grid) {
    if (item && item.pop > 0) item.pop = Math.max(0, item.pop - dt / 0.18)
  }
  state.genCooldown = Math.max(0, state.genCooldown - dt)
}

export function indexAt(x: number, y: number): number {
  const col = Math.floor((x - LAYOUT.boardX) / LAYOUT.cell)
  const row = Math.floor((y - LAYOUT.boardY) / LAYOUT.cell)
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return -1
  return row * COLS + col
}
