// 파이프 연결 — 스패닝 트리로 항상 풀 수 있는 판을 만들고 타일을 회전시켜
// 펌프에서 모든 칸으로 물이 흐르게 하는 퍼즐. 제한 시간 안에 못 풀면 게임 오버.

export type Phase = 'playing' | 'clearing' | 'over'

// 연결 비트마스크: 상 1, 우 2, 하 4, 좌 8
export const U = 1
export const R = 2
export const D = 4
export const L = 8

export interface PipesState {
  phase: Phase
  level: number
  score: number
  size: number
  masks: number[] // 현재 회전 상태의 연결 방향
  source: number // 펌프 위치
  wet: boolean[] // 물이 닿은 칸
  wetCount: number
  timeLeft: number
  clearTimer: number
  overTimer: number
  playTime: number
}

export function rotateCW(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15
}

export function sizeForLevel(level: number): number {
  if (level <= 2) return 4
  if (level <= 5) return 5
  if (level <= 8) return 6
  return 7
}

export function timeForSize(size: number): number {
  return 40 + (size - 4) * 15
}

export function clearPoints(state: PipesState): number {
  return state.size * state.size * 15 + Math.floor(state.timeLeft) * 10
}

// 랜덤 DFS 스패닝 트리 — 모든 칸이 연결된 정답 배치를 만든다
function generateTree(size: number): number[] {
  const total = size * size
  const masks = new Array<number>(total).fill(0)
  const visited = new Array<boolean>(total).fill(false)
  const stack = [Math.floor(Math.random() * total)]
  visited[stack[0]] = true
  // [dx, dy, 내 방향, 상대 방향]
  const dirs: Array<[number, number, number, number]> = [
    [0, -1, U, D],
    [1, 0, R, L],
    [0, 1, D, U],
    [-1, 0, L, R],
  ]
  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    const cx = cur % size
    const cy = Math.floor(cur / size)
    const options = dirs
      .map(([dx, dy, mine, theirs]) => {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) return null
        const next = ny * size + nx
        return visited[next] ? null : { next, mine, theirs }
      })
      .filter((o) => o !== null)
    if (options.length === 0) {
      stack.pop()
      continue
    }
    const pick = options[Math.floor(Math.random() * options.length)]
    masks[cur] |= pick.mine
    masks[pick.next] |= pick.theirs
    visited[pick.next] = true
    stack.push(pick.next)
  }
  return masks
}

// 상호 연결된 파이프만 따라 펌프에서 물을 흘린다
export function computeWet(size: number, masks: number[], source: number): boolean[] {
  const wet = new Array<boolean>(size * size).fill(false)
  wet[source] = true
  const queue = [source]
  const dirs: Array<[number, number, number, number]> = [
    [0, -1, U, D],
    [1, 0, R, L],
    [0, 1, D, U],
    [-1, 0, L, R],
  ]
  while (queue.length > 0) {
    const cur = queue.pop()!
    const cx = cur % size
    const cy = Math.floor(cur / size)
    for (const [dx, dy, mine, theirs] of dirs) {
      if (!(masks[cur] & mine)) continue
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      const next = ny * size + nx
      if (wet[next] || !(masks[next] & theirs)) continue
      wet[next] = true
      queue.push(next)
    }
  }
  return wet
}

// 클리어 판정: 모든 칸에 물이 닿고, 벽·빈 곳을 향해 새는 연결이 없어야 한다
export function isSolved(size: number, masks: number[], wet: boolean[]): boolean {
  const dirs: Array<[number, number, number, number]> = [
    [0, -1, U, D],
    [1, 0, R, L],
    [0, 1, D, U],
    [-1, 0, L, R],
  ]
  for (let i = 0; i < size * size; i++) {
    if (!wet[i]) return false
    const cx = i % size
    const cy = Math.floor(i / size)
    for (const [dx, dy, mine, theirs] of dirs) {
      if (!(masks[i] & mine)) continue
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) return false
      if (!(masks[ny * size + nx] & theirs)) return false
    }
  }
  return true
}

export function loadLevel(state: PipesState, level: number) {
  const size = sizeForLevel(level)
  const masks = generateTree(size)
  const source = Math.floor(size / 2) * size + Math.floor(size / 2)
  // 무작위 회전으로 섞는다 — 이미 풀린 판이면 한 칸 더 돌린다
  for (let i = 0; i < masks.length; i++) {
    const turns = Math.floor(Math.random() * 4)
    for (let k = 0; k < turns; k++) masks[i] = rotateCW(masks[i])
  }
  let wet = computeWet(size, masks, source)
  if (isSolved(size, masks, wet)) {
    // 회전해도 모양이 안 변하는 십자(15)는 피해서 하나 돌려 섞인 상태를 보장
    const i = masks.findIndex((m) => m !== 15)
    masks[i] = rotateCW(masks[i])
    wet = computeWet(size, masks, source)
  }
  state.level = level
  state.size = size
  state.masks = masks
  state.source = source
  state.wet = wet
  state.wetCount = wet.filter(Boolean).length
  state.timeLeft = timeForSize(size)
  state.clearTimer = 0
}

export function createState(): PipesState {
  const state: PipesState = {
    phase: 'playing',
    level: 1,
    score: 0,
    size: 4,
    masks: [],
    source: 0,
    wet: [],
    wetCount: 0,
    timeLeft: 0,
    clearTimer: 0,
    overTimer: 0,
    playTime: 0,
  }
  loadLevel(state, 1)
  return state
}

export type RotateResult = 'solved' | 'rotated' | 'none'

// 타일 회전 후 물 흐름 갱신
export function rotateTile(state: PipesState, index: number): RotateResult {
  if (state.masks[index] === 0) return 'none'
  state.masks[index] = rotateCW(state.masks[index])
  state.wet = computeWet(state.size, state.masks, state.source)
  state.wetCount = state.wet.filter(Boolean).length
  return isSolved(state.size, state.masks, state.wet) ? 'solved' : 'rotated'
}
