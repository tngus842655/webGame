import { computed, ref, watch } from 'vue'
import type { TranslationKey } from './i18n'

// 관리자 화면들이 기간을 자르는 방식. 인기도(/admin/votes)와 통계(/stats, /stats/players,
// /stats/ads)가 같은 달력을 본다 — 같은 날 두 화면을 열었는데 '이번주'가 서로 다른 구간을
// 가리키면 숫자를 견줄 수가 없다.
//
// 자르는 축은 이 기기의 달력이다. 하루는 자정에 시작하고 한 주는 월요일에 시작한다.

export type Period = 'daily' | 'weekly' | 'monthly' | 'all'
export type Half = 'prev' | 'curr'

export const PERIODS: Array<{ key: Period; labelKey: TranslationKey }> = [
  { key: 'daily', labelKey: 'admin.periodDaily' },
  { key: 'weekly', labelKey: 'admin.periodWeekly' },
  { key: 'monthly', labelKey: 'admin.periodMonthly' },
  { key: 'all', labelKey: 'admin.periodAll' },
]

// 기간마다 지난 것/진행 중인 것 한 쌍 — 누적만 쪼갤 것이 없다
export const HALVES: Record<Exclude<Period, 'all'>, [TranslationKey, TranslationKey]> = {
  daily: ['admin.periodYesterday', 'admin.periodToday'],
  weekly: ['admin.periodLastWeek', 'admin.periodThisWeek'],
  monthly: ['admin.periodLastMonth', 'admin.periodThisMonth'],
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * 고른 탭이 가리키는 달력 구간. 양끝 모두 '그 날 00:00'이고 끝날도 구간에 든다.
 * 누적이면 null — 자를 것이 없다는 뜻이다.
 *
 * 오늘이 언제인지를 인자로 받는다. 통계 화면은 이 값을 ref로 들고 있어야 자정이
 * 지났을 때 화면이 따라온다 (아래 statsToday 참고).
 */
export function periodRange(
  period: Period,
  half: Half,
  today: Date = startOfToday(),
): { first: Date; last: Date } | null {
  if (period === 'all') return null

  if (period === 'daily') {
    const day = half === 'curr' ? today : addDays(today, -1)
    return { first: day, last: day }
  }

  if (period === 'weekly') {
    // 월요일 시작 (getDay는 일요일이 0)
    const monday = addDays(today, -((today.getDay() + 6) % 7))
    return half === 'curr'
      ? { first: monday, last: today }
      : { first: addDays(monday, -7), last: addDays(monday, -1) }
  }

  return half === 'curr'
    ? { first: new Date(today.getFullYear(), today.getMonth(), 1), last: today }
    : {
        first: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        // 이번 달 0일 = 지난달 마지막 날
        last: new Date(today.getFullYear(), today.getMonth(), 0),
      }
}

// 탭 이름만으로는 구간이 정확히 어디서 끊기는지 안 보인다 — 날짜로 적어 준다
export function formatPeriodCaption(range: { first: Date; last: Date } | null): string {
  if (!range) return ''
  const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const first = md(range.first)
  const last = md(range.last)
  return first === last ? first : `${first} ~ ${last}`
}

// ── 통계 세 화면이 함께 보는 기간 ────────────────────────────────
// 요약에서 상세로 들어갔다 나와도 고른 탭이 그대로다.

export const statsPeriod = ref<Period>('daily')
export const statsHalf = ref<Half>('curr')

// 기간을 옮기면 진행 중인 쪽부터 보여준다 (오늘·이번주·이번달)
watch(statsPeriod, () => {
  statsHalf.value = 'curr'
})

// '지금'은 반응형이 아니다. 아래 computed 안에서 그냥 new Date()를 부르면 한 번 계산한
// 값이 그대로 굳어, 통계 화면을 켜둔 채 자정이 지나도 탭은 '오늘'인데 어제 숫자가 나온다.
// 서버가 매 요청마다 now()로 자르던 때는 없던 문제라, 날짜를 ref로 들고 다시 본다.
const statsToday = ref(startOfToday())

export function refreshStatsToday(): void {
  const now = startOfToday()
  // 날이 그대로면 손대지 않는다 — 새 Date를 넣으면 볼 때마다 조회가 한 번씩 더 나간다
  if (now.getTime() !== statsToday.value.getTime()) statsToday.value = now
}

// 앱을 내려놨다 다시 열었을 때. 화면 안에서 오가는 경우는 StatsPeriodTabs가 받는다.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshStatsToday()
})

/**
 * RPC에 넘길 절대 시각 구간. 보는 사람의 시간대로 계산한 자정이 그대로 실려 가므로
 * 서버는 시간대를 따로 알 필요가 없다. `to`는 끝을 포함하지 않는다(끝날 다음 자정).
 */
export const statsRange = computed<{ from: string | null; to: string | null }>(() => {
  const range = periodRange(statsPeriod.value, statsHalf.value, statsToday.value)
  if (!range) return { from: null, to: null }
  return { from: range.first.toISOString(), to: addDays(range.last, 1).toISOString() }
})

export const statsCaption = computed(() =>
  formatPeriodCaption(periodRange(statsPeriod.value, statsHalf.value, statsToday.value)),
)
