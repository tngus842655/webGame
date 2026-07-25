// 과일 2048 설정 — 수박게임과 같은 과일 아트를 공유한다 (games/fruitArt.ts)

export const SIZE = 4

export const LAYOUT = {
  width: 720,
  height: 1280,
  boardX: 40,
  boardY: 300,
  cell: 140,
  gap: 16,
} as const

export function cellPos(col: number, row: number): [number, number] {
  return [
    LAYOUT.boardX + LAYOUT.gap + col * (LAYOUT.cell + LAYOUT.gap),
    LAYOUT.boardY + LAYOUT.gap + row * (LAYOUT.cell + LAYOUT.gap),
  ]
}

// 티어 1~10은 과일(체리…수박), 11은 별, 12는 왕관
export const FRUIT_TIERS = 10
export const MAX_TIER = 12

export const SPAWN_TIER2_CHANCE = 0.1

// 합체 점수 = 2^티어
export function tierValue(tier: number): number {
  return 2 ** tier
}
