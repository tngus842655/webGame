// 마작 솔리테어 — 레이아웃·딜 생성·자유 패 판정 (렌더링과 무관한 순수 로직)
// 좌표계: x·y는 반 타일 단위 격자(겹침 표현), z는 층

export const TILE_W = 84
export const TILE_H = 108
export const HALF_W = TILE_W / 2
export const HALF_H = TILE_H / 2
export const LIFT = 7 // 층당 입체 오프셋 (z가 높을수록 좌상단으로)

export interface TilePos {
  x: number
  y: number
  z: number
}

export interface Tile extends TilePos {
  kind: string
  removed: boolean
  shake: number // 잘못된 탭 흔들림 남은 시간(초)
}

// 반 타일 격자를 직사각형으로 채운다
function grid(x0: number, y0: number, cols: number, rows: number, z: number): TilePos[] {
  const out: TilePos[] = []
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++) out.push({ x: x0 + col * 2, y: y0 + r * 2, z })
  return out
}

// 스테이지 레이아웃 3종 (스테이지 1→2→3, 이후 반복) — 세로 720폭 기준
export const LAYOUTS: readonly (readonly TilePos[])[] = [
  // ① 36타일 2층 피라미드형
  [...grid(0, 0, 6, 4, 0), ...grid(2, 8, 4, 1, 0), ...grid(2, 2, 4, 2, 1)],
  // ② 48타일 3층형 (가운데 층은 반 칸 걸침)
  [
    ...grid(0, 0, 6, 6, 0),
    ...grid(2, 3, 4, 1, 1),
    ...grid(2, 7, 4, 1, 1),
    ...grid(4, 3, 2, 1, 2),
    ...grid(4, 7, 2, 1, 2),
  ],
  // ③ 60타일 거북이 축소형 (넓은 몸통 + 중앙 4층 등딱지)
  [
    ...grid(2, 0, 6, 2, 0),
    ...grid(0, 4, 8, 2, 0),
    ...grid(2, 8, 6, 2, 0),
    ...grid(4, 3, 4, 1, 1),
    ...grid(4, 5, 4, 1, 1),
    ...grid(4, 7, 4, 1, 1),
    ...grid(5, 4, 3, 1, 2),
    ...grid(5, 6, 3, 1, 2),
    ...grid(6, 5, 2, 1, 3),
  ],
]

// 패 종류: 통수 1~9, 만수 1~9, 삭수 1~9, 바람 4, 용 2 = 33종
export const KINDS: readonly string[] = (() => {
  const out: string[] = []
  for (let n = 1; n <= 9; n++) out.push(`dot${n}`, `man${n}`, `bam${n}`)
  out.push('windN', 'windE', 'windS', 'windW', 'dragR', 'dragG')
  return out
})()

// 자유 패: 바로 위층(z+1)에 겹치는 패가 없고, 같은 층의 좌·우 중 한쪽이 비어 있으면 선택 가능
export function isFree(
  tile: TilePos,
  tiles: readonly (TilePos & { removed: boolean })[],
): boolean {
  let left = false
  let right = false
  for (const o of tiles) {
    if (o.removed || o === tile) continue
    if (o.z === tile.z + 1 && Math.abs(o.x - tile.x) < 2 && Math.abs(o.y - tile.y) < 2)
      return false
    if (o.z === tile.z && Math.abs(o.y - tile.y) < 2) {
      if (o.x === tile.x - 2) left = true
      else if (o.x === tile.x + 2) right = true
    }
  }
  return !(left && right)
}

// 남은 자유 패 중 맞출 수 있는 짝이 있는지
export function hasMoves(tiles: readonly Tile[]): boolean {
  const seen = new Set<string>()
  for (const tile of tiles) {
    if (tile.removed || !isFree(tile, tiles)) continue
    if (seen.has(tile.kind)) return true
    seen.add(tile.kind)
  }
  return false
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 역순 시뮬레이션 1회 시도: 자유 상태인 두 자리에 같은 패 쌍을 배정하고 제거 처리 반복.
// 끝까지 배정되면 그 제거 순서 자체가 해답이므로 풀 수 있는 딜이 보장된다.
export function generateDeal(
  positions: readonly TilePos[],
  pairKinds: readonly string[],
): string[] | null {
  const sim = positions.map((p) => ({ x: p.x, y: p.y, z: p.z, removed: false }))
  const kinds = new Array<string>(positions.length)
  for (const kind of shuffle([...pairKinds])) {
    const free: number[] = []
    for (let i = 0; i < sim.length; i++) if (!sim[i].removed && isFree(sim[i], sim)) free.push(i)
    if (free.length < 2) return null
    const a = free.splice(Math.floor(Math.random() * free.length), 1)[0]
    const b = free[Math.floor(Math.random() * free.length)]
    kinds[a] = kind
    kinds[b] = kind
    sim[a].removed = true
    sim[b].removed = true
  }
  return kinds
}

// 성공할 때까지 재시도. 마지막 안전망은 무작위 배정(사실상 도달하지 않는다)
export function dealTiles(positions: readonly TilePos[], pairKinds: readonly string[]): string[] {
  for (let i = 0; i < 300; i++) {
    const kinds = generateDeal(positions, pairKinds)
    if (kinds) return kinds
  }
  return shuffle(pairKinds.flatMap((k) => [k, k]))
}

export type Phase = 'playing' | 'noMoves' | 'over'

export interface MahjongState {
  phase: Phase
  stage: number // 1부터
  score: number
  tiles: Tile[]
  selected: number // 선택된 타일 인덱스, 없으면 -1
  combo: number
  lastMatchAt: number // playTime 기준 마지막 제거 시각
  playTime: number
  noMovesTimer: number // 막힘 안내 표시 후 게임오버까지
  clearTimer: number // 스테이지 클리어 연출 후 다음 스테이지까지
}

export function loadStage(state: MahjongState, stage: number) {
  const positions = LAYOUTS[(stage - 1) % LAYOUTS.length]
  const pairKinds = shuffle([...KINDS]).slice(0, positions.length / 2)
  const kinds = dealTiles(positions, pairKinds)
  state.stage = stage
  state.tiles = positions.map((p, i) => ({ ...p, kind: kinds[i], removed: false, shake: 0 }))
  state.selected = -1
  state.combo = 0
  state.lastMatchAt = -10
  state.clearTimer = 0
}

export function createState(): MahjongState {
  const state: MahjongState = {
    phase: 'playing',
    stage: 1,
    score: 0,
    tiles: [],
    selected: -1,
    combo: 0,
    lastMatchAt: -10,
    playTime: 0,
    noMovesTimer: 0,
    clearTimer: 0,
  }
  loadStage(state, 1)
  return state
}

// 광고 보상: 남은 타일을 같은 자리에서 다시 풀 수 있게 재배정
export function reshuffleRemaining(state: MahjongState) {
  const remaining = state.tiles.filter((tile) => !tile.removed)
  const counts = new Map<string, number>()
  for (const tile of remaining) counts.set(tile.kind, (counts.get(tile.kind) ?? 0) + 1)
  const pairKinds: string[] = []
  for (const [kind, count] of counts) for (let i = 0; i < count / 2; i++) pairKinds.push(kind)
  const kinds = dealTiles(remaining, pairKinds)
  remaining.forEach((tile, i) => {
    tile.kind = kinds[i]
    tile.shake = 0
  })
}
