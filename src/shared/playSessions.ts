import { ensureUserId } from './auth'
import { supabase } from './supabase'

// 플레이 시간 기록 — 인기 순위와 통계의 근거 데이터
// 게임 코드는 건드리지 않고 플레이 화면에서 진입·이탈 시점만으로 측정한다.

const MIN_SECONDS = 5 // 잘못 눌러 들어온 경우 제외
const MAX_SECONDS = 1800 // 켜두고 방치한 경우 상한 (DB 제약과 동일)

export async function recordPlaySession(slug: string, seconds: number): Promise<void> {
  const duration = Math.floor(Math.min(MAX_SECONDS, seconds))
  if (duration < MIN_SECONDS) return
  try {
    const userId = await ensureUserId()
    await supabase
      .from('play_sessions')
      .insert({ user_id: userId, game_slug: slug, duration_sec: duration })
  } catch {
    // 통계용 데이터라 실패해도 게임 진행에는 영향을 주지 않는다
  }
}

export interface GameStat {
  game_slug: string
  plays: number
  total_seconds: number
  avg_seconds: number
  players: number
  best_score: number
}

export async function fetchGameStats(days: number): Promise<GameStat[]> {
  const { data, error } = await supabase.rpc('get_game_stats', { p_days: days })
  if (error) throw error
  return (data ?? []).map((row: GameStat) => ({
    ...row,
    plays: Number(row.plays),
    total_seconds: Number(row.total_seconds),
    avg_seconds: Number(row.avg_seconds),
    players: Number(row.players),
    best_score: Number(row.best_score),
  }))
}
