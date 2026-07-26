// 개발자 노트 — 작업 기록. 날짜 기준 최신순으로 표시된다.
// 내용은 한국어로만 작성한다 (개발 기록 성격이라 번역 대상이 아님).

export interface DevNote {
  date: string
  title: string
  items: string[]
}

// 정식 오픈 시점부터 기록을 시작한다. 그전 개발 과정은 이용자에게 의미가 없다.
export const DEV_NOTES: DevNote[] = []
