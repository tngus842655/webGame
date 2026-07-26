// 룰렛 데일리 — 하루 3회 무료 스핀(+광고 2회). 연속 출석일수록 보너스 배율.
// 점수 = 오늘 획득 합계 (날짜별 localStorage, 스핀마다 제출해 최고 기록 갱신).

export type Phase = 'idle' | 'spinning' | 'day-done'

// 세그먼트 값과 가중치 (시계 방향)
export const SEGMENTS = [100, 500, 1000, 200, 2000, 300, 5000, 50]
const WEIGHTS = [20, 14, 10, 18, 6, 16, 2, 14]

export const FREE_SPINS = 3
export const AD_SPINS = 2

export interface RouletteState {
  phase: Phase
  angle: number // 휠 표시 각도 (도)
  spinFrom: number
  spinTo: number
  spinTime: number // 진행 시간
  spinDuration: number
  resultIndex: number
  lastWin: number // 직전 당첨금 (배율 적용)
  spinsLeft: number
  adUsed: boolean
  today: number // 오늘 합계 = 점수
  streak: number // 연속 출석일
  popupAge: number // 당첨 연출
}

interface DayRecord {
  date: string
  spinsUsed: number
  adUsed: boolean
  total: number
  streak: number
}

const STORE_KEY = 'webgame:roulette'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadRecord(): DayRecord | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DayRecord>
    if (typeof parsed.date !== 'string') return null
    return {
      date: parsed.date,
      spinsUsed: parsed.spinsUsed ?? 0,
      adUsed: parsed.adUsed ?? false,
      total: parsed.total ?? 0,
      streak: parsed.streak ?? 1,
    }
  } catch {
    return null
  }
}

function saveRecord(record: DayRecord) {
  localStorage.setItem(STORE_KEY, JSON.stringify(record))
}

// 오늘 기록 (없으면 어제 기록 기준으로 스트릭을 잇는 새 기록)
function todayRecord(): DayRecord {
  const prev = loadRecord()
  const today = dateKey(new Date())
  if (prev?.date === today) return prev
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const streak = prev?.date === dateKey(yesterday) ? prev.streak + 1 : 1
  return { date: today, spinsUsed: 0, adUsed: false, total: 0, streak }
}

// 연속 출석 보너스: 하루당 +10%, 최대 +100%
export function bonusPercent(streak: number): number {
  return Math.min(100, (streak - 1) * 10)
}

export function createState(): RouletteState {
  const record = todayRecord()
  const spinsLeft = Math.max(0, FREE_SPINS + (record.adUsed ? AD_SPINS : 0) - record.spinsUsed)
  return {
    phase: spinsLeft > 0 ? 'idle' : 'day-done',
    angle: 0,
    spinFrom: 0,
    spinTo: 0,
    spinTime: 0,
    spinDuration: 3,
    resultIndex: 0,
    lastWin: 0,
    spinsLeft,
    adUsed: record.adUsed,
    today: record.total,
    streak: record.streak,
    popupAge: 99,
  }
}

function pickIndex(): number {
  const total = WEIGHTS.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return i
  }
  return WEIGHTS.length - 1
}

export function startSpin(state: RouletteState): boolean {
  if (state.phase !== 'idle' || state.spinsLeft <= 0) return false
  const index = pickIndex()
  state.resultIndex = index
  const seg = 360 / SEGMENTS.length
  // 당첨 세그먼트 중심이 12시 포인터(270°) 아래 오도록 회전
  const target = ((270 - (index + 0.5) * seg) % 360 + 360) % 360
  const current = ((state.angle % 360) + 360) % 360
  state.spinFrom = state.angle
  state.spinTo = state.angle + 4 * 360 + ((target - current + 360) % 360)
  state.spinTime = 0
  state.spinDuration = 2.8 + Math.random() * 0.6
  state.phase = 'spinning'
  return true
}

export type TickResult = { landed: boolean }

export function update(state: RouletteState, dt: number): TickResult {
  state.popupAge += dt
  if (state.phase !== 'spinning') return { landed: false }
  state.spinTime += dt
  const k = Math.min(1, state.spinTime / state.spinDuration)
  const ease = 1 - (1 - k) ** 3
  state.angle = state.spinFrom + (state.spinTo - state.spinFrom) * ease
  if (k < 1) return { landed: false }

  // 착지: 당첨금 지급 + 기록 저장
  const mult = 1 + bonusPercent(state.streak) / 100
  state.lastWin = Math.round(SEGMENTS[state.resultIndex] * mult)
  state.today = Math.min(1_000_000, state.today + state.lastWin)
  state.spinsLeft -= 1
  state.popupAge = 0
  const record = todayRecord()
  saveRecord({
    ...record,
    spinsUsed: record.spinsUsed + 1,
    total: state.today,
    adUsed: state.adUsed,
  })
  state.phase = state.spinsLeft > 0 ? 'idle' : 'day-done'
  return { landed: true }
}

// 광고 보상: 오늘 스핀 +2 (하루 1회)
export function grantAdSpins(state: RouletteState): boolean {
  if (state.adUsed) return false
  state.adUsed = true
  state.spinsLeft += AD_SPINS
  if (state.phase === 'day-done') state.phase = 'idle'
  const record = todayRecord()
  saveRecord({ ...record, adUsed: true })
  return true
}
