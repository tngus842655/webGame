import { ensureUserId, getCurrentUserId } from './auth'
import { getSupabase } from './supabase'

function bestKey(slug: string) {
  return `webgame:best:${slug}`
}

export function getLocalBest(slug: string): number | null {
  const raw = localStorage.getItem(bestKey(slug))
  return raw === null ? null : Number(raw)
}

// DB check 제약(0~1,000,000)을 넘으면 insert 자체가 거부되므로 미리 클램프한다
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(1_000_000, Math.floor(score)))
}

// 최고점 갱신 시에만 기록 (홈·게임오버 화면의 "최고 기록" 표시용)
export function updateLocalBest(slug: string, score: number): void {
  if (score > (getLocalBest(slug) ?? 0)) localStorage.setItem(bestKey(slug), String(score))
}

// 진행 중 점수 저널 — 제출을 못 하고 앱이 종료돼도 다음 실행에서 올린다 { slug: score }
const PENDING_KEY = 'webgame:pendingScores'

function readPending(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function writePending(map: Record<string, number>) {
  if (Object.keys(map).length === 0) localStorage.removeItem(PENDING_KEY)
  else localStorage.setItem(PENDING_KEY, JSON.stringify(map))
}

export function stashPendingScore(slug: string, score: number): void {
  const map = readPending()
  map[slug] = clampScore(score)
  writePending(map)
}

export function clearPendingScore(slug: string): void {
  const map = readPending()
  if (!(slug in map)) return
  delete map[slug]
  writePending(map)
}

// 앱 시작 시 호출 — 지난 실행에서 제출하지 못한 점수를 복구한다
export async function flushPendingScores(): Promise<void> {
  for (const [slug, score] of Object.entries(readPending())) {
    await saveScore(slug, Number(score))
  }
}

// 점수는 Supabase에 제출하고, localStorage에도 병행 저장한다 (오프라인 대비)
export async function saveScore(slug: string, score: number): Promise<void> {
  const safe = clampScore(score)
  updateLocalBest(slug, safe)
  // 전송 도중 앱이 죽어도 복구되도록 먼저 저널에 남긴다
  stashPendingScore(slug, safe)
  try {
    const userId = await ensureUserId()
    const sb = await getSupabase()
    const { error } = await sb
      .from('scores')
      .insert({ user_id: userId, game_slug: slug, score: safe })
    if (error) throw error
    clearPendingScore(slug)
  } catch {
    // 오프라인·로그인 실패·제출 빈도 제한 — 저널이 남아 다음 실행에 재시도된다
  }
}

export interface MyGameStat {
  game_slug: string
  best_score: number
  rank: number
}

// 내 게임별 최고점·순위 (세션 없으면 익명 로그인 후 조회)
export async function fetchMyStats(): Promise<MyGameStat[]> {
  // 세션이 없다 = 아직 아무것도 기록하지 않은 방문자. 보여줄 내 기록도 없다.
  // 여기서 계정을 만들지 않는다 — 열어만 보고 나간 사람까지 쌓이지 않도록,
  // 계정은 첫 점수·플레이 기록이 만든다.
  if (!(await getCurrentUserId())) return []
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_my_stats')
  if (error) throw error
  return (data ?? []) as MyGameStat[]
}

// 서버가 아는 최고점을 로컬 캐시에 되먹인다.
//
// localStorage의 최고점은 '이 기기에서 낸 점수'만 쌓인다. 다른 기기에서 놀았거나
// 저장소를 지웠다가 소셜 로그인으로 돌아오면 서버 기록이 더 높은데, 되먹이는 곳이
// 없어서 화면마다 다른 숫자가 나왔다 — 허브·랭킹은 서버 값, 플레이 화면 최고 기록
// 칩과 게임오버 판정은 로컬 값. 그래서 이미 1,103점이 있는데도 400점에 '신기록'
// 배지가 붙는 일이 생긴다.
//
// 올리기만 한다 — 아직 제출하지 못한 점수(pending)가 로컬에 남아 있으면 그쪽이 더 높다.
export function syncLocalBests(stats: readonly MyGameStat[]): void {
  for (const stat of stats) updateLocalBest(stat.game_slug, clampScore(stat.best_score))
}

const POPULARITY_KEY = 'webgame:popularity'

// 인기도(최근 7일 플레이 시간 × sqrt(이용자 수))는 서버에서 받아오므로 첫 렌더에 쓸 수 없다.
// 마지막 응답을 저장해 두고 첫 렌더부터 그 순서로 그린다 — 화면을 보는 도중 카드가 움직이지 않도록
// 새로 받은 값은 캐시만 갱신하고 다음 진입부터 반영한다.
function cachedPopularity(): Map<string, number> {
  try {
    return new Map(JSON.parse(localStorage.getItem(POPULARITY_KEY) ?? '[]'))
  } catch {
    return new Map()
  }
}

// 동률(기록이 아직 없는 신규 게임 포함)은 레지스트리 순서 유지 — sort는 안정 정렬
const FLAGS_KEY = 'webgame:gameFlags'

interface CachedFlag {
  featured: boolean
  hidden: boolean
  sortOrder: number
  trashed: boolean
}

// 관리자가 정한 노출 설정 — 첫 화면을 서버 응답까지 기다리지 않게 캐시해 둔다
function cachedFlags(): Map<string, CachedFlag> {
  try {
    const raw = JSON.parse(localStorage.getItem(FLAGS_KEY) ?? '[]')
    return new Map(Array.isArray(raw) ? (raw as Array<[string, CachedFlag]>) : [])
  } catch {
    return new Map()
  }
}

// 캐시가 아예 없는 첫 실행인지. 홈은 평소 서버 응답을 다음 진입으로 미루지만
// (보는 도중 카드가 움직이면 안 된다) 첫 실행에는 미룰 배열 자체가 없다.
export function hasCachedFlags(): boolean {
  return localStorage.getItem(FLAGS_KEY) !== null
}

export function cacheGameFlags(rows: Array<[string, CachedFlag]>): void {
  localStorage.setItem(FLAGS_KEY, JSON.stringify(rows))
}

// 인기 순위 (1위부터). 기록이 없는 게임은 순위가 없어 지도에 들어가지 않는다.
// 반드시 현재 등록된 게임만 넘길 것 — 인기도 캐시에는 이미 지운 게임의 기록도 섞여
// 있는데(play_sessions는 남는다), 그것까지 세면 화면에 없는 번호가 중간에 빈다.
export function popularityRanks(games: readonly { slug: string }[]): Map<string, number> {
  const popularity = cachedPopularity()
  const ranked = games
    .map((game) => ({ slug: game.slug, score: popularity.get(game.slug) }))
    .filter((entry) => entry.score !== undefined)
    .sort((a, b) => b.score! - a.score!)
  return new Map(ranked.map((entry, index) => [entry.slug, index + 1]))
}

// 홈 화면이 '신규' 칸을 가르는 데 쓴다 (관리자가 상단에 올린 게임)
export function featuredSlugs(): Set<string> {
  const slugs = new Set<string>()
  for (const [slug, flag] of cachedFlags()) if (flag.featured) slugs.add(slug)
  return slugs
}

// 휴지통에 들어간 게임 — 주 목록에서는 빠지지만 홈 하단 휴지통 화면에서 계속 즐길 수 있다.
// 숨김까지 걸린 게임은 여기서도 빠진다(= 어디에도 안 나온다).
export function trashedGames<T extends { slug: string }>(games: readonly T[]): T[] {
  const flags = cachedFlags()
  return games.filter((game) => {
    const flag = flags.get(game.slug)
    return !!flag?.trashed && !flag.hidden
  })
}

// 정렬: 관리자가 고정한 게임이 맨 앞(그 안에서는 sortOrder), 나머지는 인기순.
// 휴지통·숨김 처리된 게임은 주 목록에서 뺀다.
export function sortByPopularity<T extends { slug: string }>(games: readonly T[]): T[] {
  const popularity = cachedPopularity()
  const flags = cachedFlags()
  return games
    .filter((game) => {
      const flag = flags.get(game.slug)
      return !flag?.trashed && !flag?.hidden
    })
    .slice()
    .sort((a, b) => {
      const fa = flags.get(a.slug)
      const fb = flags.get(b.slug)
      if (!!fa?.featured !== !!fb?.featured) return fa?.featured ? -1 : 1
      if (fa?.featured && fb?.featured) return (fa.sortOrder ?? 0) - (fb.sortOrder ?? 0)
      return (popularity.get(b.slug) ?? 0) - (popularity.get(a.slug) ?? 0)
    })
}

export async function refreshPopularity(): Promise<void> {
  try {
    const sb = await getSupabase()
    const { data, error } = await sb.rpc('get_game_popularity')
    if (error) return
    const rows = (data ?? []) as Array<{ game_slug: string; score: number }>
    localStorage.setItem(
      POPULARITY_KEY,
      JSON.stringify(rows.map((row) => [row.game_slug, Number(row.score)])),
    )
  } catch {
    // 캐시가 그대로 남아 다음 진입에도 마지막 순서를 유지한다
  }
}

export interface LeaderboardEntry {
  user_id: string
  nickname: string
  best_score: number
  achieved_at: string
}

export async function fetchLeaderboard(
  slug: string,
  period: 'week' | 'all',
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const since =
    period === 'week' ? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() : null
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_leaderboard', {
    p_game_slug: slug,
    p_since: since,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as LeaderboardEntry[]
}
