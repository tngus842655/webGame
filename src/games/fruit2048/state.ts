import { MAX_TIER, SIZE, SPAWN_TIER2_CHANCE, tierValue } from './config'

export type Phase = 'playing' | 'over'
export type Direction = 'left' | 'right' | 'up' | 'down'

export interface Tile {
  tier: number
  pop: number // 1 → 0으로 감쇠하는 연출 값
  popType: 'spawn' | 'merge'
}

// 슬라이드 애니메이션용 — 타일이 어디서 어디로 이동했는지
export interface SlideMove {
  from: number
  to: number
  tier: number // 이동 중 보여줄 티어(합체 전 티어)
}

export const SLIDE_DURATION = 0.11

export interface F2State {
  phase: Phase
  score: number
  grid: (Tile | null)[]
  slide: SlideMove[]
  slideT: number // 1 → 0으로 감소
  hintTime: number // 조작 힌트 애니메이션용
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
    slide: [],
    slideT: 0,
    hintTime: 0,
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
  const slide: SlideMove[] = []

  for (const line of buildLines(dir)) {
    // 이동 전 위치를 함께 들고 다녀야 애니메이션을 만들 수 있다
    const src = line
      .map((idx) => ({ idx, tile: state.grid[idx] }))
      .filter((e): e is { idx: number; tile: Tile } => e.tile !== null)

    const out: Array<{ tile: Tile; sources: Array<{ idx: number; tier: number }> }> = []
    for (let i = 0; i < src.length; i++) {
      const current = src[i]
      const next = src[i + 1]
      if (next && next.tile.tier === current.tile.tier && current.tile.tier < MAX_TIER) {
        const tier = current.tile.tier + 1
        out.push({
          tile: { tier, pop: 1, popType: 'merge' },
          sources: [
            { idx: current.idx, tier: current.tile.tier },
            { idx: next.idx, tier: next.tile.tier },
          ],
        })
        gained += tierValue(tier)
        maxMergedTier = Math.max(maxMergedTier, tier)
        i++ // 한 타일은 한 번만 합체
      } else {
        out.push({ tile: current.tile, sources: [{ idx: current.idx, tier: current.tile.tier }] })
      }
    }

    for (let i = 0; i < line.length; i++) {
      const target = line[i]
      const entry = out[i]
      state.grid[target] = entry?.tile ?? null
      if (!entry) continue
      if (entry.sources.length > 1) moved = true
      for (const source of entry.sources) {
        if (source.idx !== target) moved = true
        slide.push({ from: source.idx, to: target, tier: source.tier })
      }
    }
  }

  let gameOver = false
  if (moved) {
    state.prevGrid = snapshot
    state.prevScore = state.score
    state.score += gained
    state.slide = slide
    state.slideT = 1
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
  state.slide = []
  state.slideT = 0
  state.phase = 'playing'
  return true
}

export function updateEffects(state: F2State, dt: number) {
  state.hintTime += dt
  if (state.slideT > 0) {
    state.slideT = Math.max(0, state.slideT - dt / SLIDE_DURATION)
    if (state.slideT === 0) state.slide = []
    return // 슬라이드 중에는 등장·합체 연출을 멈춘다
  }
  for (const tile of state.grid) {
    if (tile && tile.pop > 0) tile.pop = Math.max(0, tile.pop - dt / 0.18)
  }
}
