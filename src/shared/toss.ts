// 앱인토스(토스 미니앱) 빌드에서만 켜지는 것들.
//
// 앱인토스는 웹 자산을 번들에 통째로 넣어 따로 올린다(APPS_IN_TOSS.md). 웹·안드로이드와
// 애초에 다른 빌드라, 실행 중에 환경을 알아내는 대신 빌드 때 갈라 둔다.
// SDK의 getOperationalEnvironment()는 브릿지가 없는 일반 브라우저에서 예외를 던지므로
// 웹 빌드와 코드를 공유하는 지금 구조에는 맞지 않는다.
export const isInToss = import.meta.env.VITE_TOSS === '1'

// 인가 코드를 교환할 서버. 미니앱 번들은 정적 자산이라 절대 주소로 불러야 한다
const LOGIN_ENDPOINT = import.meta.env.VITE_TOSS_LOGIN_ENDPOINT as string | undefined

// 한 번 기록했으면 이번 실행에서는 다시 묻지 않는다
let anonKeyRecorded = false

export interface TossLoginResult {
  // linked = 쓰던 계정에 그대로 붙었다 (기록 유지), switched = 다른 기기의 계정으로 갈아탔다
  mode: 'linked' | 'switched'
  tokenHash?: string
}

// SDK는 웹 번들에 실려 갈 이유가 없어 동적 import한다 (native.ts의 Capacitor 플러그인과 같은 결)
async function appLogin() {
  const { appLogin: login } = await import('@apps-in-toss/web-framework')
  return login()
}

// 토스가 주는 사용자 식별키. 미니앱별로 고유하고, 같은 사람에게는 언제나 같은 값이다.
//
// Supabase 익명 계정(user_id)은 앱 데이터를 지우면 새로 만들어져서 '1인 1회'를 셀 수
// 없다. 이 키는 지우고 다시 들어와도 유지되므로 프로모션 중복 지급을 막는 기준이 된다
// (APPS_IN_TOSS.md '프로모션').
//
// toss-docs/user-hash-key-develop.md는 게임 미니앱이 getUserKeyForGame을 쓰라고 하지만
// SDK 2.10.8에서 그 함수는 deprecated이고, getAnonymousKey의 반환 타입에서 카테고리
// 오류('INVALID_CATEGORY')가 빠졌다. 문서보다 SDK가 새것이라 이쪽을 따른다.
export async function getTossAnonymousKey(): Promise<string | null> {
  if (!isInToss) return null
  const { getAnonymousKey } = await import('@apps-in-toss/web-framework')
  const result = await getAnonymousKey()
  // 'ERROR'는 조회 실패, undefined는 토스앱이 최소 지원 버전보다 낮은 경우
  return typeof result === 'object' && result.type === 'HASH' ? result.hash : null
}

// 식별키를 지금 쓰는 계정에 붙여 둔다. 계정이 만들어지는 자리(게임 화면 진입)에서 부른다.
//
// 아직 프로모션이 이 값을 읽지는 않는다. 실기기에서 키가 내려오는지, 앱 데이터를
// 지우고 다시 들어와도 같은 값인지 확인하는 것이 지금 이 기록의 목적이다.
//
// auth는 이 파일을 import하므로(requestTossLogin) 정적으로 가져오면 순환이 된다.
export async function recordTossAnonKey(): Promise<void> {
  if (!isInToss || anonKeyRecorded) return
  try {
    const anonKey = await getTossAnonymousKey()
    if (!anonKey) return
    // 세션이 없으면 auth.uid()가 비어 기록이 실패한다. 같은 화면의 플레이 시간 측정도
    // 계정을 만들지만 그쪽을 기다려 주지 않으므로 여기서 직접 확보한다.
    const { ensureUserId } = await import('./auth')
    await ensureUserId()
    const { getSupabase } = await import('./supabase')
    const sb = await getSupabase()
    const { error } = await sb.rpc('record_toss_anon_key', { p_anon_key: anonKey })
    if (!error) anonKeyRecorded = true
  } catch {
    // 확인용 기록이라 실패해도 게임 진행에는 영향을 주지 않는다
  }
}

// 토스 로그인 창을 띄우고, 받은 인가 코드를 서버에서 교환한다.
// 인가 코드는 일회성이고 10분만 유효해서 받은 자리에서 바로 넘긴다.
export async function requestTossLogin(accessToken: string): Promise<TossLoginResult> {
  if (!LOGIN_ENDPOINT) throw new Error('VITE_TOSS_LOGIN_ENDPOINT 환경 변수가 필요합니다')

  const { authorizationCode, referrer } = await appLogin()
  const response = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer, accessToken }),
  })
  if (!response.ok) throw new Error(`토스 로그인 실패 (${response.status})`)
  return (await response.json()) as TossLoginResult
}
