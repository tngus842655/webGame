// 한글 워들 — 두 글자 단어를 기본 자모 6개로 풀어 6번 안에 맞힌다.
// 데일리 단어(날짜 시드)로 시작해 스트릭을 쌓고, 이후 연습 단어로 점수를 이어간다.
// 틀린 단어가 나오면 런 종료. 점수 = 맞힌 단어들의 합산 점수.

export type CellStatus = 'g' | 'y' | 'x' // 초록(정위치) · 노랑(포함) · 회색(없음)
export type Phase = 'playing' | 'won' | 'over'

// ── 자모 분해 ───────────────────────────────────────────────

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'

// 겹자모 → 기본 자모 (키보드는 기본 24자만 쓴다)
const SPLIT: Record<string, string> = {
  ㄲ: 'ㄱㄱ', ㄸ: 'ㄷㄷ', ㅃ: 'ㅂㅂ', ㅆ: 'ㅅㅅ', ㅉ: 'ㅈㅈ',
  ㅐ: 'ㅏㅣ', ㅒ: 'ㅑㅣ', ㅔ: 'ㅓㅣ', ㅖ: 'ㅕㅣ',
  ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅏㅣ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅓㅣ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
}

export function decompose(word: string): string[] {
  const out: string[] = []
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00
    if (code < 0 || code > 11171) continue
    const cho = CHO[Math.floor(code / 588)]
    const jung = JUNG[Math.floor((code % 588) / 28)]
    const jong = JONG[code % 28]
    for (const jamo of [cho, jung, jong]) {
      if (jamo === ' ') continue
      out.push(...(SPLIT[jamo] ?? jamo))
    }
  }
  return out
}

// 흔한 두 글자 명사 후보 — 기본 자모 6개짜리만 모듈 로드 시 걸러 쓴다
const WORDS = [
  '한글', '문장', '정답', '신발', '마늘', '하늘', '바람', '사랑', '겨울', '얼음',
  '얼굴', '눈물', '구름', '보름', '아침', '저녁', '점심', '진심', '열심', '몸살',
  '감기', '건강', '공부', '운동', '음악', '미술', '과학', '수학', '국어', '영어',
  '연필', '책상', '침대', '이불', '베개', '부엌', '거울', '청소', '빨래', '세탁',
  '요리', '반찬', '김치', '된장', '고추', '양파', '감자', '당근', '수박', '참외',
  '포도', '딸기', '과일', '야채', '채소', '생선', '계란', '빵집', '커피', '녹차',
  '홍차', '식당', '학원', '병원', '약국', '은행', '시장', '공원', '교실', '칠판',
  '분필', '학생', '친구', '가족', '부모', '형제', '자매', '남매', '삼촌', '손님',
  '주인', '사장', '직원', '회사', '월급', '용돈', '지갑', '동전', '지폐', '열쇠',
  '대문', '창문', '벽지', '천장', '바닥', '계단', '지붕', '마당', '정원', '화분',
  '나무', '꽃잎', '낙엽', '뿌리', '줄기', '열매', '씨앗', '잔디', '잡초', '곤충',
  '나비', '벌레', '개미', '거미', '모기', '파리', '매미', '토끼', '사자', '기린',
  '판다', '여우', '늑대', '참새', '까치', '펭귄', '상어', '고래', '문어', '새우',
  '조개', '미역', '바다', '강물', '호수', '연못', '폭포', '파도', '모래', '자갈',
  '바위', '동굴', '산길', '언덕', '계곡', '들판', '사막', '밀림', '숲속', '날씨',
  '장마', '태풍', '번개', '천둥', '안개', '서리', '이슬', '가뭄', '홍수', '시간',
  '시계', '달력', '오늘', '내일', '어제', '모레', '주말', '평일', '방학', '휴가',
  '명절', '설날', '추석', '생일', '잔치', '선물', '풍선', '촛불', '폭죽', '버스',
  '트럭', '기차', '신호', '도로', '다리', '터널', '육교', '머리', '이마', '눈썹',
  '콧물', '입술', '이빨', '어깨', '손목', '발목', '무릎', '허리', '배꼽', '피부',
  '근육', '심장', '옷장', '바지', '치마', '셔츠', '정장', '한복', '양말', '장갑',
  '모자', '안경', '반지', '팔찌', '가방', '구두', '장화', '우산', '부채', '밥솥',
  '접시', '그릇', '냄비', '김밥', '라면', '국수', '만두', '떡국', '갈비', '치킨',
  '피자', '사탕', '과자', '젤리', '순대', '어묵', '튀김', '호떡', '기쁨', '슬픔',
  '분노', '미움', '질투', '걱정', '불안', '행복', '우울', '놀람', '감동', '존경',
  '우정', '믿음', '약속', '진실', '비밀', '소원', '여행', '사진', '그림', '색칠',
  '만화', '영화', '연극', '노래', '게임', '인형', '장난', '블록', '퍼즐', '로봇',
  '화면', '전화', '문자', '편지', '소포', '우표', '신문', '잡지', '소설', '시집',
  '동화', '일기', '숙제', '시험', '문제', '점수', '성적', '상장', '태양', '달빛',
  '별빛', '지구', '우주', '행성', '혜성', '은하', '공기', '산소', '온도', '습도',
  '계절', '마음', '사람', '세상', '나라', '도시', '마을', '골목', '광장', '극장',
]

export interface WordEntry {
  hangul: string
  jamo: string[]
}

export const POOL: WordEntry[] = WORDS.filter(
  (word, i) => WORDS.indexOf(word) === i && decompose(word).length === 6,
).map((word) => ({ hangul: word, jamo: decompose(word) }))

export const WORD_LEN = 6
export const BASE_ROWS = 6

// ── 데일리·스트릭 ───────────────────────────────────────────

const STORE_KEY = 'webgame:wordle-daily'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dailyWord(): WordEntry {
  const d = new Date()
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  // 간단한 정수 해시로 날짜마다 다른 단어
  const hash = (seed * 2654435761) % 2 ** 31
  return POOL[Math.abs(hash) % POOL.length]
}

function loadStore(): { date: string; streak: number } | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date?: string; streak?: number }
    if (typeof parsed.date !== 'string' || typeof parsed.streak !== 'number') return null
    return { date: parsed.date, streak: parsed.streak }
  } catch {
    return null
  }
}

export function currentStreak(): number {
  const info = loadStore()
  if (!info) return 0
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (info.date === dateKey(new Date()) || info.date === dateKey(yesterday)) return info.streak
  return 0
}

export function recordDailyClear(): { streak: number; first: boolean } {
  const info = loadStore()
  const today = dateKey(new Date())
  if (info?.date === today) return { streak: info.streak, first: false }
  const streak = currentStreak() + 1
  localStorage.setItem(STORE_KEY, JSON.stringify({ date: today, streak }))
  return { streak, first: true }
}

// ── 판정 ────────────────────────────────────────────────────

// 워들 2패스 판정: 정위치 먼저, 나머지는 남은 개수만큼 노랑
export function judge(guess: string[], answer: string[]): CellStatus[] {
  const result: CellStatus[] = new Array(WORD_LEN).fill('x')
  const left: Record<string, number> = {}
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'g'
    } else {
      left[answer[i]] = (left[answer[i]] ?? 0) + 1
    }
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (result[i] === 'g') continue
    if ((left[guess[i]] ?? 0) > 0) {
      result[i] = 'y'
      left[guess[i]] -= 1
    }
  }
  return result
}

// ── 런 상태 ─────────────────────────────────────────────────

export interface WordleState {
  phase: Phase
  daily: boolean // 현재 단어가 데일리인지
  word: WordEntry
  rows: string[][] // 확정된 추측들
  results: CellStatus[][]
  current: string[] // 입력 중인 자모
  maxRows: number // 광고 보상 시 7로 늘어난다
  score: number
  streak: number
  practiceCount: number
  keyStatus: Record<string, CellStatus> // 키보드 색칠 (g > y > x)
  dailyShare: string | null // 데일리 결과 이모지 그리드
  wonTimer: number // 정답 연출 후 다음 단어로
  overTimer: number
}

function freshWord(state: WordleState, entry: WordEntry, daily: boolean) {
  state.word = entry
  state.daily = daily
  state.rows = []
  state.results = []
  state.current = []
  state.maxRows = BASE_ROWS
  state.keyStatus = {}
  state.phase = 'playing'
}

export function createState(): WordleState {
  const state: WordleState = {
    phase: 'playing',
    daily: true,
    word: dailyWord(),
    rows: [],
    results: [],
    current: [],
    maxRows: BASE_ROWS,
    score: 0,
    streak: currentStreak(),
    practiceCount: 0,
    keyStatus: {},
    dailyShare: null,
    wonTimer: 0,
    overTimer: 0,
  }
  return state
}

export function nextPracticeWord(state: WordleState) {
  let entry = state.word
  while (entry.hangul === state.word.hangul) {
    entry = POOL[Math.floor(Math.random() * POOL.length)]
  }
  state.practiceCount += 1
  freshWord(state, entry, false)
}

const EMOJI: Record<CellStatus, string> = { g: '🟩', y: '🟨', x: '⬜' }

export type SubmitResult = 'won' | 'lost' | 'next' | 'none'

// 현재 입력 확정. 판정 후 승/패/계속을 돌려준다
export function submitGuess(state: WordleState): SubmitResult {
  if (state.phase !== 'playing' || state.current.length !== WORD_LEN) return 'none'
  const guess = state.current.slice()
  const result = judge(guess, state.word.jamo)
  state.rows.push(guess)
  state.results.push(result)
  state.current = []
  const rank: Record<CellStatus, number> = { x: 0, y: 1, g: 2 }
  for (let i = 0; i < WORD_LEN; i++) {
    const prev = state.keyStatus[guess[i]]
    if (!prev || rank[result[i]] > rank[prev]) state.keyStatus[guess[i]] = result[i]
  }

  if (result.every((s) => s === 'g')) {
    const points = (state.maxRows + 1 - state.rows.length) * 100
    if (state.daily) {
      // 스트릭은 출석 표시일 뿐 점수에는 넣지 않는다 (순위표는 이번 판 실력만 반영)
      state.streak = recordDailyClear().streak
      state.dailyShare = state.results.map((row) => row.map((s) => EMOJI[s]).join('')).join('\n')
    }
    state.score = Math.min(1_000_000, state.score + points)
    state.phase = 'won'
    state.wonTimer = 1.6
    return 'won'
  }
  if (state.rows.length >= state.maxRows) {
    if (state.daily) {
      state.dailyShare = state.results.map((row) => row.map((s) => EMOJI[s]).join('')).join('\n')
    }
    state.phase = 'over'
    state.overTimer = 2.2
    return 'lost'
  }
  return 'next'
}
