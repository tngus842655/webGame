import { ref } from 'vue'
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

// 한 번 거절당하면 이번 실행에서는 더 두드리지 않는다. 예산이 소진되면 프로모션이 끝날
// 때까지 모두가 거절당하는데, 판을 마칠 때마다 SDK와 서버를 부를 이유가 없다.
// 앱을 다시 켜면 풀린다 — 그 사이에 예산이 충전됐을 수 있다.
let rejected = false

interface Stage {
  stage: number
  amount: number
}

export interface PromotionStatus {
  total: number
  granted: number
  plays: number
  // 이미 받은 단계 번호
  done: number[]
  // 예산이 소진됐거나(4112) 종료일이 지났다. 이걸 안 보면 이제 받을 수 없는 사람에게
  // '더 받을 수 있어요'라고 계속 말하게 된다 — 게임을 해도 아무것도 들어오지 않는다.
  ended: boolean
}

// 홈 배너와 안내 화면이 함께 본다. 지급을 시도한 뒤 갱신되므로 화면이 따로 조회하지 않는다
// — 계정은 claimTossPromotion()이 만들고, 그 전에 물으면 세션이 없어 조회가 막힌다.
export const promotionStatus = ref<PromotionStatus | null>(null)

// 한 번에 한 단계만 준다. 접속할 때와 판이 끝날 때마다 불리므로, 여러 단계가 한꺼번에
// 충족돼 있어도 몇 판 안에 따라잡는다.
export async function claimTossPromotion(): Promise<void> {
  if (!isInToss || !PROMOTION_CODE || running || rejected) return
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
    // 거절당했으면 사유를 남기고 물러난다. 지급을 기록하지 않으므로 다음 기회에 다시
    // 시도되고, 왜 안 됐는지는 promotion_failures에 남는다 — 실기기에서는 콘솔 로그를
    // 볼 수 없어서 이게 유일한 단서다.
    if (typeof result !== 'object' || !('key' in result)) {
      rejected = true
      const failure = describeFailure(result)
      await sb.rpc('record_promotion_failure', {
        p_stage: next.stage,
        p_code: failure.code,
        p_message: failure.message,
      })
      return
    }

    await sb.rpc('record_promotion_grant', {
      p_stage: next.stage,
      p_reward_key: result.key,
    })
  } catch {
    // 지급은 게임 진행과 무관하다 — 실패해도 조용히 넘어가고 다음에 다시 시도한다
  } finally {
    running = false
    await refreshPromotionStatus()
  }
}

// 지급 결과는 네 가지 모양으로 온다 — undefined(토스앱 버전 미달), 'ERROR'(알 수 없는 오류),
// { errorCode, message }(지급 거절), { code }. 어느 쪽이든 한 줄로 옮긴다.
function describeFailure(result: unknown): { code: string; message: string } {
  if (result === undefined) return { code: 'UNSUPPORTED_VERSION', message: '' }
  if (typeof result !== 'object' || result === null) {
    return { code: String(result), message: '' }
  }
  const row = result as Record<string, unknown>
  return {
    code: String(row.errorCode ?? row.code ?? 'UNKNOWN'),
    message: typeof row.message === 'string' ? row.message : JSON.stringify(result),
  }
}

async function refreshPromotionStatus(): Promise<void> {
  try {
    const { getSupabase } = await import('./supabase')
    const sb = await getSupabase()
    const { data } = await sb.rpc('my_promotion_status')
    promotionStatus.value = (data as PromotionStatus[] | null)?.[0] ?? null
  } catch {
    // 안내 화면이 진행 상황 없이 고지 문구만 보여준다
  }
}
