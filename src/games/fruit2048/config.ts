// 과일 2048 설정 — 수박게임과 같은 과일 진화 테마

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

// 티어 1부터 시작 (배열 인덱스 = tier - 1)
export const TIERS = [
  { emoji: '🍒', color: '#FFCDD2' },
  { emoji: '🍓', color: '#F8BBD0' },
  { emoji: '🍇', color: '#E1BEE7' },
  { emoji: '🍊', color: '#FFE0B2' },
  { emoji: '🍎', color: '#FFCCBC' },
  { emoji: '🍐', color: '#F0F4C3' },
  { emoji: '🍑', color: '#FFECB3' },
  { emoji: '🍍', color: '#FFF9C4' },
  { emoji: '🍈', color: '#DCEDC8' },
  { emoji: '🍉', color: '#C8E6C9' },
  { emoji: '⭐', color: '#FFF59D' },
  { emoji: '👑', color: '#FFE082' },
]

export const SPAWN_TIER2_CHANCE = 0.1

// 합체 점수 = 2^티어
export function tierValue(tier: number): number {
  return 2 ** tier
}
