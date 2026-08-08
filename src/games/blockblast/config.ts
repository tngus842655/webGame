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
  // 연속 클리어 배지 중심. 오른쪽 위(560, 88)에 있었는데 그 자리를 멈춤·도움말과
  // 그 아래 좋아요·싫어요 줄(GamePlayPage)이 쓴다. 그 줄 아래는 보드(y 240)까지
  // 50px밖에 안 남아 배지(60, 튀어오를 때 75)가 들어가지 않아서 왼쪽으로 옮겼다 —
  // 점수판 왼쪽의 빈 자리다.
  streakBadge: { x: 104, y: 170 },
} as const

export interface BlockColor {
  base: string
  light: string // 윗면 하이라이트
  dark: string // 아랫면·테두리 음영
}

export const COLORS: BlockColor[] = [
  { base: '#3D9BF0', light: '#7EC4FF', dark: '#1B5E9E' },
  { base: '#4CAF50', light: '#8BE08F', dark: '#256B29' },
  { base: '#FF9F2E', light: '#FFC978', dark: '#B35F00' },
  { base: '#A055C8', light: '#CE94E6', dark: '#5E2880' },
  { base: '#EF4E4E', light: '#FF9090', dark: '#9B1F1F' },
  { base: '#1FC0CC', light: '#76E4EC', dark: '#0B7480' },
]

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
  perCell: 5, // 배치한 칸 수만큼 기본 점수
  lineBase: 46, // 줄 점수 = lineBase × 줄수² (1줄 46, 2줄 184, 3줄 414)
  streakBonus: 23, // 연속 클리어 보너스 = (streak-1) × streakBonus
  allClear: 300, // 보드를 완전히 비우면 (2줄 184와 3줄 414 사이 — 잭팟이되 줄 점수를 안 넘게)
} as const
