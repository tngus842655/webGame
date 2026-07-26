import { ensureUserId } from './auth'
import { supabase } from './supabase'

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
    const { error } = await supabase
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
  await ensureUserId()
  const { data, error } = await supabase.rpc('get_my_stats')
  if (error) throw error
  return (data ?? []) as MyGameStat[]
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
export function sortByPopularity<T extends { slug: string }>(games: readonly T[]): T[] {
  const popularity = cachedPopularity()
  return [...games].sort((a, b) => (popularity.get(b.slug) ?? 0) - (popularity.get(a.slug) ?? 0))
}

export async function refreshPopularity(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_game_popularity')
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
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_game_slug: slug,
    p_since: since,
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as LeaderboardEntry[]
}
