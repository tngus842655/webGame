import { SIZE, SPAWN_TIER2_CHANCE, TIERS, tierValue } from './config'

export type Phase = 'playing' | 'over'
export type Direction = 'left' | 'right' | 'up' | 'down'

export interface Tile {
  tier: number
  pop: number // 1 → 0으로 감쇠하는 연출 값
  popType: 'spawn' | 'merge'
}

export interface F2State {
  phase: Phase
  score: number
  grid: (Tile | null)[]
  // 광고 되돌리기용 직전 상태
  prevGrid: (Tile | null)[] | null
  prevScore: number
}

function emptyIndices(grid: (Tile | null)[]): number[] {
  const out: number[] = []
  for (let i = 0; i < grid.length; i++) if (grid[i] === null) out.push(i)
  return out
}

export function spawnTile(state: F2State) {
  const empty = emptyIndices(state.grid)
  if (empty.length === 0) return
  const idx = empty[Math.floor(Math.random() * empty.length)]
  const tier = Math.random() < SPAWN_TIER2_CHANCE ? 2 : 1
  state.grid[idx] = { tier, pop: 1, popType: 'spawn' }
}

export function createState(): F2State {
  const state: F2State = {
    phase: 'playing',
    score: 0,
    grid: new Array<Tile | null>(SIZE * SIZE).fill(null),
    prevGrid: null,
    prevScore: 0,
  }
  spawnTile(state)
  spawnTile(state)
  return state
}

// 방향별 순회 라인(밀리는 쪽이 배열 앞)
function buildLines(dir: Direction): number[][] {
  const lines: number[][] = []
  for (let a = 0; a < SIZE; a++) {
    const line: number[] = []
    for (let b = 0; b < SIZE; b++) {
      switch (dir) {
        case 'left':
          line.push(a * SIZE + b)
          break
        case 'right':
          line.push(a * SIZE + (SIZE - 1 - b))
          break
        case 'up':
          line.push(b * SIZE + a)
          break
        case 'down':
          line.push((SIZE - 1 - b) * SIZE + a)
          break
      }
    }
    lines.push(line)
  }
  return lines
}

export function hasMoves(grid: (Tile | null)[]): boolean {
  if (emptyIndices(grid).length > 0) return true
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const tier = grid[row * SIZE + col]?.tier
      if (col + 1 < SIZE && grid[row * SIZE + col + 1]?.tier === tier) return true
      if (row + 1 < SIZE && grid[(row + 1) * SIZE + col]?.tier === tier) return true
    }
  }
  return false
}

export interface MoveResult {
  moved: boolean
  gained: number
  maxMergedTier: number
  gameOver: boolean
}

export function move(state: F2State, dir: Direction): MoveResult {
  const snapshot = state.grid.map((t) => (t ? { ...t } : null))
  let moved = false
  let gained = 0
  let maxMergedTier = 0

  for (const line of buildLines(dir)) {
    const tiles = line.map((i) => state.grid[i]).filter((t): t is Tile => t !== null)
    const merged: Tile[] = []
    for (let i = 0; i < tiles.length; i++) {
      const current = tiles[i]
      const next = tiles[i + 1]
      if (next && next.tier === current.tier && current.tier < TIERS.length) {
        const tier = current.tier + 1
        merged.push({ tier, pop: 1, popType: 'merge' })
        gained += tierValue(tier)
        maxMergedTier = Math.max(maxMergedTier, tier)
        i++ // 한 타일은 한 번만 합체
      } else {
        merged.push(current)
      }
    }
    for (let i = 0; i < line.length; i++) {
      const tile = merged[i] ?? null
      if ((state.grid[line[i]]?.tier ?? 0) !== (tile?.tier ?? 0)) moved = true
      state.grid[line[i]] = tile
    }
  }

  let gameOver = false
  if (moved) {
    state.prevGrid = snapshot
    state.prevScore = state.score
    state.score += gained
    spawnTile(state)
    gameOver = !hasMoves(state.grid)
    if (gameOver) state.phase = 'over'
  }
  return { moved, gained, maxMergedTier, gameOver }
}

// 광고 보상: 직전 수로 되돌리기
export function undo(state: F2State): boolean {
  if (!state.prevGrid) return false
  state.grid = state.prevGrid
  state.score = state.prevScore
  state.prevGrid = null
  state.phase = 'playing'
  return true
}

export function updateEffects(state: F2State, dt: number) {
  for (const tile of state.grid) {
    if (tile && tile.pop > 0) tile.pop = Math.max(0, tile.pop - dt / 0.18)
  }
}
