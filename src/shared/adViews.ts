import type { AdMedium, AdOutcome } from './ads'
import { ensureUserId } from './auth'
import { getSupabase } from './supabase'

// 리워드 광고 호출 기록 — 어느 매체의 어느 게임 어느 자리에서 광고를 부르고, 그게
// 어떻게 끝났는지. AdMob 콘솔은 광고 단위 하나로 묶여 있어 게임별·자리별로 쪼갤 수
// 없다. 여기서 세는 값의 쓸모는 그 분해와 '눌렀는데 광고가 안 떴다'(unavailable)를
// 보는 데 있다. 테스트 광고는 부르는 쪽에서 걸러 아예 들어오지 않는다.

export async function recordAdView(
  slug: string,
  placement: string,
  medium: AdMedium,
  outcome: AdOutcome,
): Promise<void> {
  try {
    const userId = await ensureUserId()
    const sb = await getSupabase()
    await sb
      .from('ad_views')
      .insert({ user_id: userId, game_slug: slug, placement, medium, outcome })
  } catch {
    // 통계용 데이터라 실패해도 보상 지급에는 영향을 주지 않는다
  }
}

export interface AdStat {
  medium: AdMedium
  slug: string
  placement: string
  viewed: number
  dismissed: number
  unavailable: number
  total: number
}

interface AdStatRow {
  medium: AdMedium
  game_slug: string
  placement: string
  viewed: number
  dismissed: number
  unavailable: number
}

// 관리자만 통과한다 (get_ad_stats()의 첫 줄이 막는다)
export async function fetchAdStats(days: number): Promise<AdStat[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_ad_stats', { p_days: days })
  if (error) throw error
  return ((data ?? []) as AdStatRow[]).map((row) => {
    const viewed = Number(row.viewed)
    const dismissed = Number(row.dismissed)
    const unavailable = Number(row.unavailable)
    return {
      medium: row.medium,
      slug: row.game_slug,
      placement: row.placement,
      viewed,
      dismissed,
      unavailable,
      total: viewed + dismissed + unavailable,
    }
  })
}
