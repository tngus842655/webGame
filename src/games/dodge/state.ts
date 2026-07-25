// 낙하물 회피 — 드래그로 좌우 이동, 생존 시간 경쟁

export const PLAYER_Y = 1060
export const PLAYER_R = 30
export const FIELD = { left: 40, right: 680 } as const

export type Phase = 'playing' | 'over'

export interface Rock {
  x: number
  y: number
  r: number
  vy: number
  vx: number
}

export interface DodgeState {
  phase: Phase
  time: number
  playerX: number
  rocks: Rock[]
  spawnTimer: number
  invuln: number // 남은 무적 시간(광고 부활 직후)
}

export function scoreOf(state: DodgeState): number {
  return Math.floor(state.time * 10)
}

export function createState(): DodgeState {
  return {
    phase: 'playing',
    time: 0,
    playerX: 360,
    rocks: [],
    spawnTimer: 1,
    invuln: 0,
  }
}

export function update(state: DodgeState, dt: number): boolean {
  state.time += dt
  state.invuln = Math.max(0, state.invuln - dt)

  state.spawnTimer -= dt
  if (state.spawnTimer <= 0) {
    state.spawnTimer = Math.max(0.16, 0.55 - state.time * 0.01)
    state.rocks.push({
      x: FIELD.left + Math.random() * (FIELD.right - FIELD.left),
      y: 120,
      r: 16 + Math.random() * 26,
      vy: 480 + state.time * 10 + Math.random() * 160,
      vx: (Math.random() - 0.5) * 120,
    })
  }

  for (const rock of state.rocks) {
    rock.y += rock.vy * dt
    rock.x += rock.vx * dt
  }
  state.rocks = state.rocks.filter((rock) => rock.y < 1320)

  if (state.invuln <= 0) {
    for (const rock of state.rocks) {
      const dx = rock.x - state.playerX
      const dy = rock.y - PLAYER_Y
      const hit = rock.r + PLAYER_R - 6
      if (dx * dx + dy * dy < hit * hit) {
        state.phase = 'over'
        return true
      }
    }
  }
  return false
}
