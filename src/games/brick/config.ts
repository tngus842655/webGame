// 벽돌깨기 RPG 밸런스·레이아웃 수치는 전부 이 파일에서만 조정한다

export const LAYOUT = {
  width: 720,
  height: 1280,
  fieldLeft: 30,
  fieldRight: 688,
  fieldTop: 170,
  launchY: 1040, // 발사선 (공이 여기로 돌아오면 착지)
  cols: 7,
  rowH: 94,
  gap: 6,
} as const

export const COL_W = (LAYOUT.fieldRight - LAYOUT.fieldLeft) / LAYOUT.cols

// 벽돌이 이 줄 번호에 도달하면 게임오버
export const MAX_ROWS = Math.floor((LAYOUT.launchY - LAYOUT.fieldTop) / LAYOUT.rowH)

export function brickRect(col: number, row: number) {
  return {
    x: LAYOUT.fieldLeft + col * COL_W + LAYOUT.gap / 2,
    y: LAYOUT.fieldTop + row * LAYOUT.rowH + LAYOUT.gap / 2,
    w: COL_W - LAYOUT.gap,
    h: LAYOUT.rowH - LAYOUT.gap,
  }
}

export const BALL = {
  radius: 10,
  speed: 1400, // px/s
  launchInterval: 0.07, // 공 순차 발사 간격(초)
} as const

export const WAVE = {
  minBricks: 2,
  maxBricks: 4,
  doubleHpChance: 0.3, // HP 2배 벽돌 등장 확률
} as const

export interface UpgradeDef {
  key: 'attack' | 'balls'
  label: string
  baseCost: number
  growth: number // 비용 = baseCost × growth^(레벨-1)
}

export const UPGRADES: UpgradeDef[] = [
  { key: 'attack', label: '공격력', baseCost: 15, growth: 1.6 },
  { key: 'balls', label: '공 개수', baseCost: 30, growth: 1.9 },
]

// UPGRADES와 같은 순서의 버튼 영역
export const BUTTON_RECTS = [
  { x: 40, y: 1110, w: 310, h: 130 },
  { x: 370, y: 1110, w: 310, h: 130 },
]

export const SAVE_KEY = 'webgame:brick:save'
