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

// 게임별 인기도 점수 (최근 7일 플레이 시간 × sqrt(이용자 수))
export async function fetchPopularity(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_game_popularity')
  if (error) throw error
  const map = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ game_slug: string; score: number }>) {
    map.set(row.game_slug, Number(row.score))
  }
  return map
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
