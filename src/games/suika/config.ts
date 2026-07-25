// 밸런스 수치는 전부 이 파일에서만 조정한다 (DESIGN.md 7.2)

export const BOARD = {
  width: 720,
  height: 1280,
  wallLeft: 55,
  wallRight: 665,
  jarTopY: 310,
  floorY: 1114,
  dangerY: 390,
  dropY: 235,
} as const

export interface FruitTier {
  name: string
  radius: number
  mergeScore: number
  color: string
  faceColor: string
  dropWeight: number // 0이면 드롭으로 등장하지 않음
}

export const TIERS: FruitTier[] = [
  { name: '체리', radius: 26, mergeScore: 1, color: '#E53935', faceColor: '#3E2723', dropWeight: 30 },
  { name: '딸기', radius: 36, mergeScore: 3, color: '#EC407A', faceColor: '#4A0E24', dropWeight: 25 },
  { name: '포도', radius: 42, mergeScore: 6, color: '#AB47BC', faceColor: '#311B92', dropWeight: 20 },
  { name: '오렌지', radius: 50, mergeScore: 10, color: '#FFA726', faceColor: '#3E2723', dropWeight: 15 },
  { name: '사과', radius: 62, mergeScore: 15, color: '#EF5350', faceColor: '#3E2723', dropWeight: 10 },
  { name: '배', radius: 70, mergeScore: 21, color: '#D4E157', faceColor: '#33691E', dropWeight: 0 },
  { name: '복숭아', radius: 78, mergeScore: 28, color: '#FFAB91', faceColor: '#4E342E', dropWeight: 0 },
  { name: '파인애플', radius: 88, mergeScore: 36, color: '#FFD54F', faceColor: '#5D4037', dropWeight: 0 },
  { name: '멜론', radius: 98, mergeScore: 45, color: '#C5E1A5', faceColor: '#33691E', dropWeight: 0 },
  { name: '수박', radius: 115, mergeScore: 55, color: '#4CAF50', faceColor: '#1B2E1B', dropWeight: 0 },
]

// 수박+수박 합체 시 둘 다 소멸하며 받는 보너스
export const WATERMELON_BONUS = 100

export const PHYSICS = {
  gravityY: 1.6,
  restitution: 0.2,
  friction: 0.5,
} as const

export const RULES = {
  dropCooldown: 0.5, // 초
  gameOverSeconds: 1.5, // 위험선 위 안착 상태 지속 시간
  settleSpeed: 1.5, // 이 속도 미만이면 안착으로 간주 (px/step)
} as const
