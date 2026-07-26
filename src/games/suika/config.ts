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
  color: string // 본체 기본색 (그라데이션 중심)
  dark: string // 가장자리 음영·장식 선 색
  faceColor: string
  dropWeight: number // 0이면 드롭으로 등장하지 않음
}

// 색은 서로 충분히 떨어뜨린다 — 하단 진화 도표는 반지름 22px로 그려서
// 무늬가 거의 안 보이고 색과 실루엣만 남는다. 특히 체리와 사과가 둘 다
// 비슷한 빨강이면 구분되지 않아, 사과는 훨씬 진한 쪽으로 내렸다.
export const TIERS: FruitTier[] = [
  { name: '체리', radius: 26, mergeScore: 1, color: '#F2453D', dark: '#9B1F1A', faceColor: '#4A1010', dropWeight: 30 },
  { name: '딸기', radius: 36, mergeScore: 3, color: '#FF5C86', dark: '#A81E52', faceColor: '#4A0E24', dropWeight: 25 },
  { name: '포도', radius: 42, mergeScore: 6, color: '#9B59D0', dark: '#4E1E70', faceColor: '#33124A', dropWeight: 20 },
  { name: '오렌지', radius: 50, mergeScore: 10, color: '#FF9012', dark: '#B85C00', faceColor: '#5A2E00', dropWeight: 15 },
  { name: '사과', radius: 62, mergeScore: 15, color: '#B32424', dark: '#6B0F12', faceColor: '#3A0B0B', dropWeight: 10 },
  { name: '배', radius: 70, mergeScore: 21, color: '#D2E05A', dark: '#87962A', faceColor: '#3E4A12', dropWeight: 0 },
  { name: '복숭아', radius: 78, mergeScore: 28, color: '#FFAE8C', dark: '#D9694A', faceColor: '#7A3A24', dropWeight: 0 },
  { name: '파인애플', radius: 88, mergeScore: 36, color: '#FFD02E', dark: '#AD7C12', faceColor: '#5D4008', dropWeight: 0 },
  { name: '멜론', radius: 98, mergeScore: 45, color: '#AEDE84', dark: '#6E9445', faceColor: '#33501E', dropWeight: 0 },
  { name: '수박', radius: 115, mergeScore: 55, color: '#3E9E45', dark: '#0F4A14', faceColor: '#0A2A0D', dropWeight: 0 },
]

// 수박+수박 합체 시 둘 다 소멸하며 받는 보너스.
// 체리부터 수박 하나를 만드는 데 드는 합체 점수가 1,981점이라 100점은 이 게임의
// 최종 목표치고 너무 초라했다 (들인 것의 5%). 두 개를 붙인 값이 나게 올린다.
export const WATERMELON_BONUS = 1000

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
