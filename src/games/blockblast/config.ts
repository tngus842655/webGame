// 블록 블라스트 밸런스·레이아웃 수치는 전부 이 파일에서만 조정한다

export const GRID = 8

// 논리 해상도 720×1280 기준 레이아웃
export const LAYOUT = {
  width: 720,
  height: 1280,
  boardX: 60,
  boardY: 240,
  cell: 75, // 8칸 = 600px
  trayY: 1010, // 트레이 슬롯 중심 y
  traySlots: [160, 360, 560],
  trayScale: 0.45,
  dragLift: 100, // 드래그 중 손가락 위로 띄우는 높이
} as const

export const COLORS = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EF5350', '#26C6DA']

export interface PieceShape {
  cells: ReadonlyArray<readonly [number, number]> // [col, row]
  weight: number
}

const shape = (cells: Array<[number, number]>, weight: number): PieceShape => ({ cells, weight })

// SHAPES[0]은 반드시 1×1 (광고 보상 블록 교체 시 배치 가능성 보장에 사용)
export const SHAPES: PieceShape[] = [
  shape([[0, 0]], 2),
  // 직선 2~5
  shape([[0, 0], [1, 0]], 3),
  shape([[0, 0], [0, 1]], 3),
  shape([[0, 0], [1, 0], [2, 0]], 3),
  shape([[0, 0], [0, 1], [0, 2]], 3),
  shape([[0, 0], [1, 0], [2, 0], [3, 0]], 2),
  shape([[0, 0], [0, 1], [0, 2], [0, 3]], 2),
  shape([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 1),
  shape([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 1),
  // 사각형
  shape([[0, 0], [1, 0], [0, 1], [1, 1]], 3),
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], 2),
  shape([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]], 2),
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 1),
  // ㄱ자 (3칸, 4방향)
  shape([[0, 0], [1, 0], [1, 1]], 2),
  shape([[0, 0], [1, 0], [0, 1]], 2),
  shape([[0, 0], [0, 1], [1, 1]], 2),
  shape([[1, 0], [0, 1], [1, 1]], 2),
  // ㄱ자 (5칸, 3×3, 4방향)
  shape([[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], 1),
  shape([[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], 1),
  shape([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 1),
  shape([[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]], 1),
]

export const SCORING = {
  perCell: 1, // 배치한 칸 수만큼 기본 점수
  lineBase: 10, // 줄 점수 = lineBase × 줄수² (1줄 10, 2줄 40, 3줄 90)
  streakBonus: 5, // 연속 클리어 보너스 = (streak-1) × streakBonus
} as const
