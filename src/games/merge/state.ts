// 머지 가든 — 제한 시간 안에 황금 화분(최종 단계)을 목표 개수만큼 만드는 단계별 도전.
// 같은 단계끼리 합쳐 키우는 규칙은 그대로, 생성은 쿨다운 없이 탭한 만큼 나온다.

export const COLS = 5
export const ROWS = 7

// 아이템 단계 수 (그림은 plantArt.ts) — 8단계 황금 화분이 목표.
// 12단계였을 때는 화분 하나에 2048(=2^11)어치가 필요해 탭 80회 + 드래그 80회가 들었다.
// 조합은 늘 '같은 단계 둘'뿐이라 보드는 사실상 누적 생성량의 이진수이고, 위치 전략도 없다
// (dropItem에 인접 제한이 없다). 그래서 길이가 곧 노가다였다 — 128어치로 줄인다
export const MAX_LEVEL = 8

// 생성 확률(%) — 1~7단계. 최종 단계(황금 화분)는 버튼으로 나오지 않는다: 합쳐서만 만들 수 있다.
// 무게중심을 3~5단계로 옮겼다. 예전 표는 진행량의 44%가 1.7%짜리 희귀 스폰에서 나와
// 잘해서 이기는 게 아니라 잭팟을 기다리는 판이었다. 지금은 상위 둘(7%)이 39%를 맡는다.
// 합이 100이라 예전처럼 남은 1%가 1단계로 새지도 않는다
const SPAWN_PERCENT = [20, 23, 23, 17, 10, 5, 2] as const

// 점수는 다른 게임과 자릿수를 맞춘다: 화분 하나 = 100점, 남은 시간 1초 = 5점.
// 가이드 13개 언어(guides.ts merge.score)가 원래 이 숫자로 적혀 있었다 — 코드가 어긋나 있던 쪽이다.
// 전판을 깨면 약 9,100점으로, 화분이 사실상 못 나오던 시절에 맞춰 부풀린 470/23을 되돌린다
const HARVEST_POINTS = 100
export const TIME_BONUS = 5

export const MAX_STAGE = 10

// 스테이지 목표: n단계 = 황금 화분 n개
export function stageGoal(stage: number): number {
  return stage
}

// 제한 시간: 목표가 늘수록 시간도 늘지만 화분 1개당 여유는 계속 줄어든다.
// 중급 손 속도(탭 0.25초·드래그 0.65초)로 화분 하나가 약 15초다. 1단계는 그중 27%만 쓰고
// 10단계에서 59%까지 올라간다 — 손이 느린 사람은 9~10단계에서 시간에 걸린다.
// 시간을 먼저 줄이면 노가다가 사라지는 게 아니라 급해지기만 한다. 분량(MAX_LEVEL)을
// 줄인 다음에 조이는 순서라야 한다
export function stageSeconds(stage: number): number {
  return 55 + (stage - 1) * 22
}

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

export type Phase = 'playing' | 'stageClear' | 'over'
// cleared = 10단계까지 통과해 끝냈다 (실패로 끝난 판과 구분)

export interface Item {
  level: number // 1부터, ITEMS 인덱스는 level-1
  pop: number
}

export interface MergeState {
  phase: Phase
  stage: number
  score: number
  goldMade: number // 이번 스테이지에서 수확한 황금 화분 수
  timeLeft: number
  grid: (Item | null)[]
  hintTime: number // 조작 힌트 애니메이션용
  hintDone: boolean // 첫 조작(생성·이동)을 했는지 — 조작 힌트 종료 조건
  discovered: number // 이번 판에서 만든 최고 단계
  cleared: boolean // 10단계까지 통과
  clearTimer: number // 스테이지 완료 연출
  lastBonus: number // 방금 받은 보너스 점수 (연출용)
}

export function createState(): MergeState {
  return {
    phase: 'playing',
    stage: 1,
    score: 0,
    goldMade: 0,
    timeLeft: stageSeconds(1),
    grid: new Array<Item | null>(COLS * ROWS).fill(null),
    hintTime: 0,
    hintDone: false,
    discovered: 1,
    cleared: false,
    clearTimer: 0,
    lastBonus: 0,
  }
}

export function indexAt(x: number, y: number): number {
  const col = Math.floor((x - LAYOUT.boardX) / LAYOUT.cell)
  const row = Math.floor((y - LAYOUT.boardY) / LAYOUT.cell)
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return -1
  return row * COLS + col
}

function emptyIndices(grid: (Item | null)[]): number[] {
  const out: number[] = []
  for (let i = 0; i < grid.length; i++) if (grid[i] === null) out.push(i)
  return out
}

// 빈 칸이 남아 있는지 — 생성 버튼 활성 조건
export function hasEmptyCell(state: MergeState): boolean {
  return state.grid.some((item) => item === null)
}

// 보드에 남아 있는 최고 단계 (시간 초과 시 점수로 환산)
export function maxBoardLevel(state: MergeState): number {
  let max = 0
  for (const item of state.grid) if (item && item.level > max) max = item.level
  return max
}

function rollLevel(): number {
  let r = Math.random() * 100
  for (let i = 0; i < SPAWN_PERCENT.length; i++) {
    r -= SPAWN_PERCENT[i]
    if (r <= 0) return i + 1
  }
  return 1
}

export interface GenerateResult {
  ok: boolean
  level: number
}

// 생성 — 쿨다운 없이 빈 칸이 있으면 언제든 나온다
export function generate(state: MergeState): GenerateResult {
  if (state.phase !== 'playing') return { ok: false, level: 0 }
  const empty = emptyIndices(state.grid)
  if (empty.length === 0) return { ok: false, level: 0 }
  const idx = empty[Math.floor(Math.random() * empty.length)]
  const level = rollLevel()
  state.grid[idx] = { level, pop: 1 }
  state.discovered = Math.max(state.discovered, level)
  state.hintDone = true
  return { ok: true, level }
}

export interface DropResult {
  merged: boolean
  newLevel: number
  harvested: boolean // 황금 화분 완성
  stageClear: boolean
}

// from의 아이템을 to 칸에 놓는다 (합체/이동/실패).
// 황금 화분이 되면 그 자리에서 수확되어 자리를 비운다
export function dropItem(state: MergeState, from: number, to: number): DropResult {
  const result: DropResult = { merged: false, newLevel: 0, harvested: false, stageClear: false }
  const item = state.grid[from]
  if (!item || from === to || state.phase !== 'playing') return result
  const target = state.grid[to]

  if (target === null) {
    state.grid[to] = item
    state.grid[from] = null
    state.hintDone = true
    return result
  }
  if (target.level !== item.level || item.level >= MAX_LEVEL) return result

  const newLevel = item.level + 1
  state.grid[from] = null
  state.discovered = Math.max(state.discovered, newLevel)
  state.hintDone = true
  result.merged = true
  result.newLevel = newLevel

  if (newLevel >= MAX_LEVEL) {
    state.grid[to] = null // 수확
    state.goldMade += 1
    state.score += HARVEST_POINTS
    result.harvested = true
    if (state.goldMade >= stageGoal(state.stage)) {
      // 남은 시간을 점수로 환산하고 다음 스테이지 준비
      state.lastBonus = Math.round(state.timeLeft) * TIME_BONUS
      state.score = Math.min(1_000_000, state.score + state.lastBonus)
      if (state.stage >= MAX_STAGE) state.cleared = true
      state.phase = 'stageClear'
      state.clearTimer = 2.2
      result.stageClear = true
    }
  } else {
    state.grid[to] = { level: newLevel, pop: 1 }
  }
  state.score = Math.min(1_000_000, state.score)
  return result
}

// 광고 보상: 보드에서 가장 낮은 단계 아이템들을 제거해 자리 확보
export function clearLowestItems(state: MergeState) {
  let lowest = Infinity
  for (const item of state.grid) if (item) lowest = Math.min(lowest, item.level)
  if (!Number.isFinite(lowest)) return
  for (let i = 0; i < state.grid.length; i++) {
    if (state.grid[i]?.level === lowest) state.grid[i] = null
  }
}

export interface TickEvents {
  timeUp: boolean
  nextStage: boolean
}

export function update(state: MergeState, dt: number): TickEvents {
  const events: TickEvents = { timeUp: false, nextStage: false }
  state.hintTime += dt
  for (const item of state.grid) {
    if (item && item.pop > 0) item.pop = Math.max(0, item.pop - dt / 0.18)
  }

  if (state.phase === 'playing') {
    state.timeLeft -= dt
    if (state.timeLeft <= 0) {
      state.timeLeft = 0
      // 못 채운 스테이지에서도 키워낸 만큼은 점수로 인정한다 (단계가 높을수록 크게).
      // 뺄 값은 체인 길이를 따라간다 — 8단계 체인에서는 보드 최고가 7단계라 최대 32점(화분 1/3)
      state.lastBonus = 2 ** Math.max(0, maxBoardLevel(state) - 2)
      state.score = Math.min(1_000_000, state.score + state.lastBonus)
      state.phase = 'over'
      events.timeUp = true
    }
  } else if (state.phase === 'stageClear') {
    state.clearTimer -= dt
    if (state.clearTimer <= 0) {
      if (state.cleared) {
        // 10단계 통과 — 판이 끝난다
        state.phase = 'over'
        events.timeUp = true
        return events
      }
      state.stage += 1
      state.goldMade = 0
      state.timeLeft = stageSeconds(state.stage)
      state.phase = 'playing'
      events.nextStage = true
    }
  }
  return events
}

// 광고 보상으로 시간을 되살려 같은 스테이지를 이어간다
export function reviveWithTime(state: MergeState, seconds: number) {
  state.timeLeft = seconds
  state.phase = 'playing'
}
