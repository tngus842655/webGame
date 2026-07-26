// 집중 나무 — 정한 시간 동안 화면을 지키면 나무가 자란다. 이탈하면 시든다.
// 점수 = 오늘 하루 누적 집중 분 (localStorage로 날짜별 합산).

export type Phase = 'select' | 'growing' | 'withered' | 'done'

export const DURATIONS = [10, 25, 50] // 분

export interface FocusState {
  phase: Phase
  minutes: number // 이번 세션 목표(분)
  elapsed: number // 이번 세션 경과(초)
  playTime: number
}

export function createState(): FocusState {
  return { phase: 'select', minutes: 0, elapsed: 0, playTime: 0 }
}

export const progress = (state: FocusState) =>
  state.minutes === 0 ? 0 : Math.min(1, state.elapsed / (state.minutes * 60))

// ── 오늘 누적 집중 분 ───────────────────────────────────────

const STORE_KEY = 'webgame:focus-today'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayMinutes(): number {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { date?: string; minutes?: number }
    if (parsed.date !== todayKey() || typeof parsed.minutes !== 'number') return 0
    return parsed.minutes
  } catch {
    return 0
  }
}

// 완료한 세션을 누적하고 오늘 합계를 돌려준다
export function addTodayMinutes(minutes: number): number {
  const total = todayMinutes() + minutes
  localStorage.setItem(STORE_KEY, JSON.stringify({ date: todayKey(), minutes: total }))
  return total
}
