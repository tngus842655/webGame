// 보석 매치3 상수

export const COLS = 8
export const ROWS = 8
export const CELL = 80
export const BOARD_X = 40
export const BOARD_Y = 300

export const FALL_SPEED = 1800 // 낙하 속도 (px/s)
export const SWAP_DURATION = 0.16 // 스왑 애니메이션 시간 (s)
export const START_MOVES = 25
export const LEVEL_MOVES = 10 // 레벨업 보상 이동 횟수
export const CONTINUE_MOVES = 5 // 광고 보상 이동 횟수
export const FIRST_GOAL = 1000
export const MAX_SCORE = 1_000_000 // DB check 제약

export type GemShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon' | 'star'

export interface GemDef {
  shape: GemShape
  light: string
  base: string
  dark: string
}

// 색과 도형을 함께 달리해 색약에도 구분되게
export const GEMS: GemDef[] = [
  { shape: 'circle', light: '#FF9DAD', base: '#E8354F', dark: '#8F1830' },
  { shape: 'diamond', light: '#8FD0FF', base: '#2E86E0', dark: '#164B8D' },
  { shape: 'square', light: '#8FE8AC', base: '#27B45C', dark: '#0F6132' },
  { shape: 'triangle', light: '#FFD38F', base: '#F28C1D', dark: '#8F4E07' },
  { shape: 'hexagon', light: '#D7ADFF', base: '#9350E8', dark: '#4F2187' },
  { shape: 'star', light: '#FFF3A6', base: '#F4C51D', dark: '#93720A' },
]
