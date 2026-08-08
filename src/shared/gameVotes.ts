import { todayKey } from '@/games/daily'
import { ensureUserId } from './auth'
import { getSupabase } from './supabase'

// 게임별 좋아요/싫어요 — 게임 화면 오른쪽 위에서 하루에 한 표씩.
//
// 화면이 보는 값은 이 기기의 localStorage다. 판에 들어설 때마다 서버에 물으면
// 화살표가 빈 채로 떴다가 뒤늦게 채워지는데, 그 깜빡임이 표 하나보다 거슬린다.
// '하루 한 표'를 실제로 지키는 것은 서버의 기본키((user_id, game_slug, vote_day))라,
// 기기를 바꿔 다시 눌러도 새 표가 아니라 같은 줄을 덮어쓴다.

export type VoteValue = 1 | -1

const storeKey = (slug: string) => `webgame:vote-${slug}`

// 오늘 이 게임에 남긴 표. 날짜가 넘어가면 어제 표는 없는 것과 같다
export function readVote(slug: string): VoteValue | null {
  try {
    const raw = localStorage.getItem(storeKey(slug))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { day?: string; vote?: number }
    if (parsed.day !== todayKey()) return null
    return parsed.vote === 1 || parsed.vote === -1 ? parsed.vote : null
  } catch {
    return null
  }
}

// null이면 오늘 표를 거둔다. 실패하면 던진다 — 화면이 눌린 표시를 되돌려야 하므로
// (조용히 삼키면 저장되지 않은 표가 눌린 채로 남는다).
export async function saveVote(slug: string, vote: VoteValue | null): Promise<void> {
  const userId = await ensureUserId()
  const sb = await getSupabase()
  const day = todayKey()

  if (vote === null) {
    const { error } = await sb
      .from('game_votes')
      .delete()
      .eq('user_id', userId)
      .eq('game_slug', slug)
      .eq('vote_day', day)
    if (error) throw error
    localStorage.removeItem(storeKey(slug))
    return
  }

  const { error } = await sb
    .from('game_votes')
    .upsert(
      { user_id: userId, game_slug: slug, vote_day: day, vote },
      { onConflict: 'user_id,game_slug,vote_day' },
    )
  if (error) throw error
  localStorage.setItem(storeKey(slug), JSON.stringify({ day, vote }))
}

export interface VoteStat {
  slug: string
  up: number
  down: number
}

// 관리자만 통과한다 (get_game_vote_stats()의 첫 줄이 막는다).
// 기간은 vote_day 기준의 yyyy-mm-dd 양끝 포함 구간이고, 둘 다 null이면 전체 누적이다.
export async function fetchVoteStats(
  start: string | null,
  end: string | null,
): Promise<VoteStat[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_game_vote_stats', { p_start: start, p_end: end })
  if (error) throw error
  return ((data ?? []) as Array<{ game_slug: string; up: number; down: number }>).map((row) => ({
    slug: row.game_slug,
    up: Number(row.up),
    down: Number(row.down),
  }))
}
