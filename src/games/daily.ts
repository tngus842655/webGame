// 게임 공통 데일리·스트릭 (localStorage).
// 스도쿠(sudoku/state.ts)의 날짜·스트릭 패턴을 슬러그별 키로 일반화한 것 —
// 다른 게임에 데일리를 붙일 때는 이 모듈을 가져다 쓴다.
// (스도쿠는 기존 저장 키('webgame:sudoku-daily')를 지켜야 해서 자기 구현을 그대로 둔다.)

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

// 같은 날짜 = 같은 시드 (기기 시간대 기준, 스도쿠와 같은 방식)
export function dailySeed(): number {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// 시드 고정 난수 — 오늘의 딜을 모두에게 같게 만든다
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const storeKey = (slug: string) => `webgame:daily-${slug}`

function loadStore(slug: string): { date: string; streak: number } | null {
  try {
    const raw = localStorage.getItem(storeKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date?: string; streak?: number }
    if (typeof parsed.date !== 'string' || typeof parsed.streak !== 'number') return null
    return { date: parsed.date, streak: parsed.streak }
  } catch {
    return null
  }
}

// 이어지고 있는 스트릭 (마지막 달성이 오늘·어제가 아니면 끊긴 것)
export function currentStreak(slug: string): number {
  const info = loadStore(slug)
  if (!info) return 0
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (info.date === todayKey() || info.date === dateKey(yesterday)) return info.streak
  return 0
}

export function isDoneToday(slug: string): boolean {
  return loadStore(slug)?.date === todayKey()
}

// 오늘 목표 달성 기록. 갱신된 스트릭을 돌려준다 (이미 기록한 날이면 그대로)
export function recordDailyDone(slug: string): number {
  const info = loadStore(slug)
  const today = todayKey()
  if (info?.date === today) return info.streak
  const streak = currentStreak(slug) + 1
  localStorage.setItem(storeKey(slug), JSON.stringify({ date: today, streak }))
  return streak
}
