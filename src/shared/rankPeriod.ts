// 랭킹이 기간을 자르는 방식 — 모두가 같은 판에서 겨루므로 구간도 하나여야 한다.
// 보는 사람의 기기 시간대로 자르면 서울과 LA가 서로 다른 '이번 주'를 보게 되고,
// 명예의 전당 1위가 보는 사람마다 달라진다. 한국 우선 앱이라 KST(UTC+9)로 고정한다.
// KST는 서머타임이 없어 오프셋이 상수다.
//
// 관리자 통계(adminPeriod.ts)는 보는 기기의 달력으로 자른다 — 그쪽은 혼자 보는 화면이라
// 구간이 사람마다 달라도 사고가 안 난다. 여기와 섞지 말 것.
//
// 한 주는 월요일 00:00(KST)에 시작한다. `to`는 구간에 들지 않는다(다음 구간의 시작).

const KST_OFFSET_MS = 9 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

export interface RankRange {
  from: Date
  to: Date
}

// 지금이 KST 달력으로 몇 년·몇 월·며칠·무슨 요일인지
function kstParts(now: Date): { y: number; m: number; d: number; dow: number } {
  const k = new Date(now.getTime() + KST_OFFSET_MS)
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), dow: k.getUTCDay() }
}

// KST 달력의 (y, m, d) 00:00을 절대 시각으로. Date.UTC가 월·일 넘침을 알아서 접는다.
function kstMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - KST_OFFSET_MS)
}

export function thisWeekRange(now: Date = new Date()): RankRange {
  const { y, m, d, dow } = kstParts(now)
  // 월요일 시작 (getUTCDay는 일요일이 0)
  const monday = d - ((dow + 6) % 7)
  return { from: kstMidnight(y, m, monday), to: kstMidnight(y, m, monday + 7) }
}

export function thisMonthRange(now: Date = new Date()): RankRange {
  const { y, m } = kstParts(now)
  return { from: kstMidnight(y, m, 1), to: kstMidnight(y, m + 1, 1) }
}

// 지난달 — 명예의 전당이 겨루는 구간
export function prevMonthRange(now: Date = new Date()): RankRange {
  const { y, m } = kstParts(now)
  return { from: kstMidnight(y, m - 1, 1), to: kstMidnight(y, m, 1) }
}

// 지난달이 몇 년 몇 월인지 (m은 1부터) — 명예의 전당 제목에 쓴다
export function prevMonthLabel(now: Date = new Date()): { y: number; m: number } {
  const { y, m } = kstParts(now)
  const k = new Date(Date.UTC(y, m - 1, 1))
  return { y: k.getUTCFullYear(), m: k.getUTCMonth() + 1 }
}

// 명예의 전당이 처음으로 기릴 달 — 실제 운영을 시작한 2026년 8월.
// 그전(7월)은 비공개 테스트 기록이라 테스트 계정이 1위를 다 쥐고 있다.
const HALL_FIRST = { y: 2026, m: 8 }

// 기릴 지난달이 생겼는지. 2026년 9월 1일(KST)부터 참이 되고,
// 그전에는 랭킹보기의 입구 배너도 서지 않는다.
export function hallMonthReady(now: Date = new Date()): boolean {
  const { y, m } = prevMonthLabel(now)
  return y > HALL_FIRST.y || (y === HALL_FIRST.y && m >= HALL_FIRST.m)
}

// 구간을 KST 달력 날짜로 적는다 — 탭 이름만으로는 어디서 끊기는지 안 보인다.
// to는 미포함이라 하루 물려 마지막 날을 적는다.
export function formatRankRange(range: RankRange): string {
  const md = (t: Date) => {
    const k = new Date(t.getTime() + KST_OFFSET_MS)
    return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`
  }
  return `${md(range.from)} ~ ${md(new Date(range.to.getTime() - DAY_MS))}`
}
