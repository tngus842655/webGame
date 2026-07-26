// 낙하물 회피 — 드래그로 좌우 이동, 생존 시간 경쟁

export const PLAYER_Y = 1060
export const PLAYER_R = 30
export const FIELD = { left: 40, right: 680 } as const

export type Phase = 'playing' | 'over'

// 낙하물 종류 — 모양·색이 달라 지루함을 덜고, 크기와 속도도 함께 달라진다
export type HazardKind = 'rock' | 'ice' | 'log' | 'anvil' | 'meteor'

const KINDS: HazardKind[] = ['rock', 'ice', 'log', 'anvil', 'meteor']

export interface Rock {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  kind: HazardKind
  spin: number // 고정 회전 오프셋
}

export interface DodgeState {
  phase: Phase
  time: number
  playerX: number
  rocks: Rock[]
  spawnTimer: number
  invuln: number // 남은 무적 시간(광고 부활 직후)
  grazes: number // 스치듯 피한 횟수
}

export const GRAZE_POINTS = 5

export function scoreOf(state: DodgeState): number {
  return Math.floor(state.time * 10) + state.grazes * GRAZE_POINTS
}

export function createState(): DodgeState {
  return {
    phase: 'playing',
    time: 0,
    playerX: 360,
    rocks: [],
    spawnTimer: 1,
    invuln: 0,
    grazes: 0,
  }
}

// 스침 판정 여유 — 이 안쪽으로 지나가면 보너스
const GRAZE_MARGIN = 46

export interface TickResult {
  died: boolean
  grazed: boolean
}

export function update(state: DodgeState, dt: number): TickResult {
  const result: TickResult = { died: false, grazed: false }
  state.time += dt
  state.invuln = Math.max(0, state.invuln - dt)

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    // 예전엔 0.55초 간격으로 시작해 첫 초부터 최고 밀도에 가까웠다. 실력 차이가 드러날
    // 여유를 주려고 느슨하게 시작해서 2분에 걸쳐 조여든다.
    state.spawnTimer = Math.max(0.22, 1.1 - state.time * 0.0073)
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)]
    // 운석은 작고 빠르게, 통나무는 크고 느리게
    const fast = kind === 'meteor'
    const heavy = kind === 'log' || kind === 'anvil'
    state.rocks.push({
      x: FIELD.left + Math.random() * (FIELD.right - FIELD.left),
      y: 120,
      r: (heavy ? 26 : 16) + Math.random() * (fast ? 14 : 24),
      vy: (fast ? 700 : 460) + state.time * 10 + Math.random() * 160,
      vx: (Math.random() - 0.5) * (heavy ? 60 : 140),
      kind,
      spin: Math.random() * Math.PI * 2,
    })
  }

  for (const rock of state.rocks) {
    const wasAbove = rock.y <= PLAYER_Y
    rock.y += rock.vy * dt
    rock.x += rock.vx * dt
    // 플레이어 높이를 막 지나간 순간에만 스침을 센다 (한 낙하물당 최대 1회)
    if (wasAbove && rock.y > PLAYER_Y && state.invuln <= 0) {
      const dx = Math.abs(rock.x - state.playerX)
      if (dx < rock.r + PLAYER_R + GRAZE_MARGIN) {
        state.grazes += 1
        result.grazed = true
      }
    }
  }
  state.rocks = state.rocks.filter((rock) => rock.y < 1320)

  if (state.invuln <= 0) {
    for (const rock of state.rocks) {
      const dx = rock.x - state.playerX
      const dy = rock.y - PLAYER_Y
      const hit = rock.r + PLAYER_R - 6
      if (dx * dx + dy * dy < hit * hit) {
        state.phase = 'over'
        result.died = true
        return result
      }
    }
  }
  return result
}
