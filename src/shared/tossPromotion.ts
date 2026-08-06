import { isInToss, recordTossAnonKey } from './toss'

// 앱인토스 프로모션 — 접속 20원, 1판 30원, 누적 3판 50원 (1인 100원).
// 단계 조건과 금액은 전부 서버(next_promotion_stage)가 정한다. 여기서는 서버가 정해 준
// 금액을 SDK에 그대로 넘기기만 한다 — 클라이언트가 금액을 만들면 얼마든지 바꿔 부를 수 있다.
//
// 지급되면 토스가 자체 토스트('미니게임30에서 20원을 지급했어요')를 띄우므로
// 앱이 따로 알릴 것이 없다.
//
// 이건 운영 코드다. 테스트 번들은 TEST_ 접두사가 붙은 코드로 덮어써서 만든다
// (APPS_IN_TOSS.md '프로모션').
const PROMOTION_CODE = import.meta.env.VITE_TOSS_PROMOTION_CODE as string | undefined

// 접속과 게임오버가 겹쳐 두 번 들어오면 같은 단계를 두 번 지급할 수 있다
let running = false

interface Stage {
  stage: number
  amount: number
}

// 한 번에 한 단계만 준다. 접속할 때와 판이 끝날 때마다 불리므로, 여러 단계가 한꺼번에
// 충족돼 있어도 몇 판 안에 따라잡는다.
export async function claimTossPromotion(): Promise<void> {
  if (!isInToss || !PROMOTION_CODE || running) return
  running = true
  try {
    // 서버가 auth.uid()로 식별키를 찾으므로 등록이 먼저다 (계정도 여기서 만들어진다)
    await recordTossAnonKey()
    const { getSupabase } = await import('./supabase')
    const sb = await getSupabase()
    const { data, error } = await sb.rpc('next_promotion_stage')
    const next = (data as Stage[] | null)?.[0]
    if (error || !next) return

    const { grantPromotionReward } = await import('@apps-in-toss/web-framework')
    const result = await grantPromotionReward({
      params: { promotionCode: PROMOTION_CODE, amount: next.amount },
    })
    // 'ERROR'는 알 수 없는 오류, undefined는 토스앱 버전 미달, errorCode는 지급 거절.
    // 어느 쪽이든 기록하지 않으므로 다음 기회에 다시 시도된다.
    if (typeof result !== 'object' || !('key' in result)) return

    await sb.rpc('record_promotion_grant', {
      p_stage: next.stage,
      p_reward_key: result.key,
    })
  } catch {
    // 지급은 게임 진행과 무관하다 — 실패해도 조용히 넘어가고 다음에 다시 시도한다
  } finally {
    running = false
  }
}
