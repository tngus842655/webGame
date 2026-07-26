// 점프 챌린지 — 홀드로 게이지를 모아 점프, 제한 시간 안에 최대한 높이 오른다.
// 월드 좌표는 위로 갈수록 y가 커지고, 점수는 최고 높이(m).

export type Phase = 'playing' | 'over'

export interface Platform {
  x: number // 중심
  w: number
  y: number // 윗면 높이
}

export interface JumpState {
  phase: Phase
  x: number // 발 기준 중심
  y: number
  vx: number
  vy: number
  grounded: boolean
  charge: number // 0~1
  charging: boolean
  aim: number // -1~1, 터치 위치로 정하는 수평 성분 (0이면 수직 점프)
  maxHeight: number
  timeLeft: number
  camY: number // 화면 중심의 월드 높이
  platforms: Platform[]
  genY: number // 다음 발판을 만들 높이
  genX: number // 직전 층 발판 위치 — 다음 층은 이 근처에 둬서 도달 가능성을 보장
  overTimer: number
  playTime: number
}

export const WORLD_W = 720
export const PLAYER_HALF = 22
const GRAVITY = 2600
const CHARGE_TIME = 0.8

export function createState(): JumpState {
  const state: JumpState = {
    phase: 'playing',
    x: 360,
    y: 0,
    vx: 0,
    vy: 0,
    grounded: true,
    charge: 0,
    charging: false,
    aim: 0,
    maxHeight: 0,
    timeLeft: 180,
    camY: 540,
    platforms: [{ x: 360, w: 720, y: 0 }],
    genY: 180,
    genX: 360,
    overTimer: 0,
    playTime: 0,
  }
  ensurePlatforms(state, 2000)
  return state
}

// 위로 갈수록 발판이 좁아지고 간격이 벌어진다.
// 주 발판은 직전 층에서 점프로 닿는 수평 범위 안에만 둔다.
export function ensurePlatforms(state: JumpState, upTo: number) {
  while (state.genY < upTo) {
    const h = state.genY
    const width = Math.max(90, 210 - h / 60)
    const w = width * (0.8 + Math.random() * 0.4)
    const minX = Math.max(20 + w / 2, state.genX - 420)
    const maxX = Math.min(WORLD_W - 20 - w / 2, state.genX + 420)
    const x = minX + Math.random() * (maxX - minX)
    state.platforms.push({ x, w, y: h })
    state.genX = x
    if (Math.random() < 0.35) {
      const w2 = width * (0.8 + Math.random() * 0.4)
      const x2 = 20 + w2 / 2 + Math.random() * (WORLD_W - 40 - w2)
      state.platforms.push({ x: x2, w: w2, y: h + 40 + Math.random() * 60 })
    }
    state.genY += 150 + Math.random() * Math.min(200, 80 + h / 40)
  }
}

export interface StepEvents {
  jumped: boolean
  landed: boolean
  bounced: boolean
  timeUp: boolean
}

export function step(state: JumpState, dt: number): StepEvents {
  const events: StepEvents = { jumped: false, landed: false, bounced: false, timeUp: false }
  if (state.phase !== 'playing') return events

  state.timeLeft -= dt
  if (state.timeLeft <= 0) {
    state.timeLeft = 0
    state.phase = 'over'
    state.overTimer = 0.7
    events.timeUp = true
    return events
  }

  // 차지: 가득 차면 자동 점프
  if (state.charging && state.grounded) {
    state.charge = Math.min(1, state.charge + dt / CHARGE_TIME)
    if (state.charge >= 1) {
      releaseJump(state)
      events.jumped = true
    }
  }

  if (!state.grounded) {
    const prevY = state.y
    state.vy -= GRAVITY * dt
    state.x += state.vx * dt
    state.y += state.vy * dt

    // 벽 반동
    if (state.x < PLAYER_HALF) {
      state.x = PLAYER_HALF
      state.vx = -state.vx * 0.65
      events.bounced = true
    } else if (state.x > WORLD_W - PLAYER_HALF) {
      state.x = WORLD_W - PLAYER_HALF
      state.vx = -state.vx * 0.65
      events.bounced = true
    }

    // 하강 중 발판 윗면에 착지 (아래에서는 통과)
    if (state.vy <= 0) {
      let best: Platform | null = null
      for (const p of state.platforms) {
        if (p.y > prevY + 1 || p.y < state.y) continue
        if (Math.abs(state.x - p.x) > p.w / 2 + PLAYER_HALF * 0.6) continue
        if (!best || p.y > best.y) best = p
      }
      if (best) {
        state.y = best.y
        state.vy = 0
        state.vx = 0
        state.grounded = true
        events.landed = true
      }
    }
    state.maxHeight = Math.max(state.maxHeight, state.y)
  }

  // 카메라: 플레이어보다 약간 위를 부드럽게 따라간다
  const target = Math.max(540, state.y + 150)
  state.camY += (target - state.camY) * Math.min(1, dt * 6)

  ensurePlatforms(state, state.camY + 1000)
  return events
}

export function startCharge(state: JumpState, aim: number) {
  if (state.phase !== 'playing' || !state.grounded) return
  state.charging = true
  state.charge = 0
  state.aim = aim
}

export function setAim(state: JumpState, aim: number) {
  state.aim = Math.max(-1, Math.min(1, aim))
}

export function releaseJump(state: JumpState): boolean {
  if (!state.charging) return false
  state.charging = false
  if (!state.grounded || state.phase !== 'playing') return false
  const k = state.charge
  state.vy = 750 + k * 950
  state.vx = state.aim * (150 + k * 400)
  state.grounded = false
  state.charge = 0
  return true
}

export const meters = (h: number) => Math.floor(h / 100)
