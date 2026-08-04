// 앱인토스(토스 미니앱) 빌드에서만 켜지는 것들.
//
// 앱인토스는 웹 자산을 번들에 통째로 넣어 따로 올린다(APPS_IN_TOSS.md). 웹·안드로이드와
// 애초에 다른 빌드라, 실행 중에 환경을 알아내는 대신 빌드 때 갈라 둔다.
// SDK의 getOperationalEnvironment()는 브릿지가 없는 일반 브라우저에서 예외를 던지므로
// 웹 빌드와 코드를 공유하는 지금 구조에는 맞지 않는다.
export const isInToss = import.meta.env.VITE_TOSS === '1'

// 인가 코드를 교환할 서버. 미니앱 번들은 정적 자산이라 절대 주소로 불러야 한다
const LOGIN_ENDPOINT = import.meta.env.VITE_TOSS_LOGIN_ENDPOINT as string | undefined

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
