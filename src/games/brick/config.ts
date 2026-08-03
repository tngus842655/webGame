// 벽돌깨기 밸런스·레이아웃 수치는 전부 이 파일에서만 조정한다

export const LAYOUT = {
  width: 720,
  height: 1280,
  fieldLeft: 30,
  fieldRight: 688,
  fieldTop: 170,
  launchY: 1040, // 발사선 (공이 여기로 돌아오면 착지)
  cols: 14,
  rowH: 47, // COL_W와 같게 두어 벽돌이 정사각이 된다
  gap: 4,
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

// 수평에 가까운 조준 금지. 눕혀 쏘면 경로가 2h/sinθ로 늘어나 한 턴에 판 전체를 쓸어버린다 —
// 0.15(수평에서 9°)일 때 이 조준 하나가 정상 플레이의 21.8배 점수를 냈다.
// 0.45 = 수평에서 27°. 근거는 GAME_BALANCE.md 3.3.
export const MIN_AIM_SLOPE = 0.45

// 같은 제한을 |dy| / |dx| 로 바꾼 값. 조준을 최소 각도로 붙일 때 쓴다
export const MIN_AIM_TAN = MIN_AIM_SLOPE / Math.sqrt(1 - MIN_AIM_SLOPE ** 2)

export const BALL = {
  radius: 7,
  speed: 1400, // px/s
  count: 5, // 상점을 걷어내 고정. 공이 늘면 턴 시간이 그만큼 길어진다
  step: 6, // 한 번에 나아가는 거리. 반지름보다 작아야 벽돌을 뚫고 지나간다
  launchInterval: 0.07, // 공 순차 발사 간격(초)
} as const

export const WAVE = {
  minBricks: 11,
  maxBricks: 13, // 14열 기준 79~93%. 벽을 이뤄야 공이 벽돌 사이를 파고든다
  doubleHpChance: 0.3, // HP 2배 벽돌 등장 확률
  hpGrowth: 1, // 잠정: 벽돌 HP = ceil(웨이브 × 이 값)
  itemChance: 0.07, // 잠정: 새 벽돌이 공격력 강화를 품을 확률
} as const

// 발사선 아래, 예전 상점 버튼 자리. 누르는 곳이 아니라 읽는 곳이다
export const ATTACK_PANEL = { x: 210, y: 1118, w: 300, h: 84 } as const
