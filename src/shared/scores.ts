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
export async function saveScore(slug: string, score: number): Promise<void> {
  const localBest = getLocalBest(slug) ?? 0
  if (score > localBest) localStorage.setItem(bestKey(slug), String(score))
  try {
    const userId = await ensureUserId()
    const { error } = await supabase
      .from('scores')
      .insert({ user_id: userId, game_slug: slug, score })
    if (error) throw error
  } catch {
    // 오프라인·로그인 실패 시 로컬 기록만 남긴다
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
