import { ensureUserId } from './auth'
import { supabase } from './supabase'

function bestKey(slug: string) {
  return `webgame:best:${slug}`
}

export function getLocalBest(slug: string): number | null {
  const raw = localStorage.getItem(bestKey(slug))
  return raw === null ? null : Number(raw)
}

// 점수는 Supabase에 제출하고, localStorage에도 병행 저장한다 (오프라인 대비)
// DB check 제약(0~1,000,000)을 넘으면 insert 자체가 거부되므로 미리 클램프한다
export async function saveScore(slug: string, score: number): Promise<void> {
  const safe = Math.max(0, Math.min(1_000_000, Math.floor(score)))
  const localBest = getLocalBest(slug) ?? 0
  if (safe > localBest) localStorage.setItem(bestKey(slug), String(safe))
  try {
    const userId = await ensureUserId()
    const { error } = await supabase
      .from('scores')
      .insert({ user_id: userId, game_slug: slug, score: safe })
    if (error) throw error
  } catch {
    // 오프라인·로그인 실패 시 로컬 기록만 남긴다
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
