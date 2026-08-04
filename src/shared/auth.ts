import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { getSupabase, whenSupabaseReady } from './supabase'
import { AUTH_CALLBACK, closeAuthTab, isNative, openAuthTab, watchAuthTab } from './native'
import { requestTossLogin } from './toss'

export type SocialProvider = 'google' | 'kakao'

// 앱인토스에서는 구글·카카오를 쓸 수 없어 토스 로그인이 그 자리를 대신한다.
// 연결된 계정 표시는 세 가지를 함께 다룬다
export type LinkedAccount = SocialProvider | 'toss'

// 연동 요청을 보낸 제공자 — OAuth 리다이렉트로 돌아왔을 때 어떤 버튼이었는지 알기 위해 남긴다
const PENDING_KEY = 'webgame:pendingProvider'

let cachedUserId: string | null = null

// 현재 계정에 연결된 소셜 제공자 (없으면 게스트) — 설정 화면과 허브 팝업이 함께 본다
export const linkedProvider = ref<LinkedAccount | null>(null)

function readProvider(user: User | null | undefined): LinkedAccount | null {
  // 토스는 Supabase provider가 아니라서 identities에 없다 — 서버가 넣어 준 표시를 본다
  if (user?.user_metadata?.toss_user_key != null) return 'toss'
  const found = user?.identities?.find(
    (identity) => identity.provider === 'google' || identity.provider === 'kakao',
  )
  return (found?.provider as SocialProvider | undefined) ?? null
}

// 계정 전환은 OAuth 리다이렉트를 거치므로 메모리 변수로는 이전 계정을 알 수 없다.
// 마지막 계정 id를 저장해두고, 달라졌으면 이전 계정의 로컬 최고점을 정리한다
// (홈 화면이 이전 계정 기록을 새 계정 것처럼 보여주는 문제 방지. 키는 scores.ts와 공유)
const LAST_USER_KEY = 'webgame:lastUserId'

function clearLocalBestsIfUserChanged(nextId: string) {
  const last = localStorage.getItem(LAST_USER_KEY)
  if (last && last !== nextId) {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('webgame:best:')) localStorage.removeItem(key)
    }
  }
  localStorage.setItem(LAST_USER_KEY, nextId)
}

// 클라이언트를 늦게 만들므로 구독도 그때 건다 — 만들어지기 전에는 바뀔 세션도 없다
whenSupabaseReady((sb) => {
  sb.auth.onAuthStateChange((_event, session) => {
    cachedUserId = session?.user.id ?? null
    // 연동(link)은 id가 그대로라 정리 대상이 아니다 — 다른 계정으로 갈아탄 경우에만 지워진다
    if (cachedUserId) clearLocalBestsIfUserChanged(cachedUserId)
    linkedProvider.value = readProvider(session?.user)
  })
})

// 세션이 없으면 익명 로그인으로 부트스트랩 (DESIGN.md 6장 인증 흐름)
export async function ensureUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId
  const sb = await getSupabase()
  const { data } = await sb.auth.getSession()
  let session = data.session
  if (!session) {
    const { data: anon, error } = await sb.auth.signInAnonymously()
    if (error) throw error
    session = anon.session
  }
  if (!session) throw new Error('세션을 만들지 못했습니다')
  cachedUserId = session.user.id
  return cachedUserId
}

// 계정은 사라졌는데 토큰만 남은 상태에서 빠져나오는 길.
// JWT는 계정이 있든 없든 만료 전까지 형식상 유효해서 supabase-js가 세션을 그대로
// 들고 있는다(액세스 토큰이 살아 있으면 갱신에 실패해도 보존한다). 그동안 프로필
// 조회도 소셜 연동도 전부 막히므로, 끊고 새 게스트 계정을 만들어 준다.
// 부르는 쪽은 '계정이 없다'가 확실할 때만 부를 것 — 네트워크 오류로 부르면
// 멀쩡한 세션을 날린다.
export async function resetSession(): Promise<string> {
  const sb = await getSupabase()
  // 지워진 계정의 토큰이라 서버는 401/404로 답하지만, 그 경우도 로컬 세션은 지워진다
  await sb.auth.signOut()
  cachedUserId = null
  linkedProvider.value = null
  return ensureUserId()
}

// 회원 탈퇴. 지우는 일은 전부 delete_my_account()가 하고, 여기서는 흔적만 정리한다
// (세션을 끊지 않으면 이미 없는 계정의 토큰으로 요청이 나간다).
export async function deleteMyAccount(): Promise<void> {
  const sb = await getSupabase()
  const { error } = await sb.rpc('delete_my_account')
  if (error) throw error
  await sb.auth.signOut()
  cachedUserId = null
  linkedProvider.value = null
  localStorage.removeItem(LAST_USER_KEY)
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('webgame:best:')) localStorage.removeItem(key)
  }
}

// 자동 로그인 없이 현재 세션만 조회 (랭킹에서 내 순위 강조용)
export async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId
  const sb = await getSupabase()
  const { data } = await sb.auth.getSession()
  return data.session?.user.id ?? null
}

// 로그인 창을 어디로 보내고 어디로 돌려받을지.
// 웹은 페이지가 통째로 리다이렉트되어 /settings로 돌아오고,
// 네이티브는 커스텀 탭에서 로그인한 뒤 딥링크로 앱이 다시 열린다.
function oauthOptions() {
  return {
    redirectTo: isNative ? AUTH_CALLBACK : `${location.origin}/settings`,
    // 네이티브에서는 supabase가 웹뷰를 로그인 페이지로 보내면 안 된다.
    // 주소만 받아서 커스텀 탭으로 연다 (구글이 웹뷰 안 OAuth를 거부한다)
    skipBrowserRedirect: isNative,
  }
}

// 커스텀 탭에서 돌아오기를 기다리는 쪽. 웹에서는 쓰이지 않는다
let pending: { done: (ok: boolean) => void; fail: (reason: unknown) => void } | null = null

// 웹은 위에서 이미 페이지가 넘어갔으므로 이 아래로 내려오지 않는다.
// 네이티브만 로그인 창을 열고, 딥링크가 돌아와 세션 교환까지 끝나야 반환된다.
// 반환값 = 로그인이 실제로 끝났는가 (그냥 닫고 나왔으면 false).
async function awaitOAuth(url: string | null): Promise<boolean> {
  if (!isNative) return false
  if (!url) throw new Error('로그인 주소를 받지 못했습니다')
  return new Promise<boolean>((resolve, reject) => {
    pending = { done: resolve, fail: reject }
    void openAuthTab(url)
  })
}

// 지금 쓰던 계정에 소셜 identity를 붙인다 — user_id가 그대로라 점수·랭킹이 유지된다
export async function linkSocial(provider: SocialProvider): Promise<boolean> {
  await ensureUserId()
  sessionStorage.setItem(PENDING_KEY, provider)
  const sb = await getSupabase()
  const { data, error } = await sb.auth.linkIdentity({ provider, options: oauthOptions() })
  if (error) {
    sessionStorage.removeItem(PENDING_KEY)
    throw error
  }
  return awaitOAuth(data.url)
}

// 이미 다른 기기에서 연동해둔 계정으로 로그인 — 그 계정의 기록을 그대로 이어받는다
export async function signInSocial(provider: SocialProvider): Promise<boolean> {
  sessionStorage.removeItem(PENDING_KEY)
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signInWithOAuth({ provider, options: oauthOptions() })
  if (error) throw error
  return awaitOAuth(data.url)
}

// 앱인토스 전용 로그인. 구글·카카오와 달리 OAuth 리다이렉트가 없어서 창이 닫히면
// 그 자리에서 끝난다 — 돌아오기를 기다리는 장치가 필요 없다.
// 처음이면 지금 쓰던 계정에 묶이고(기록 유지), 다른 기기에서 이미 연동해 뒀으면
// 그 계정으로 갈아탄다.
export async function loginWithToss(): Promise<void> {
  await ensureUserId()
  const sb = await getSupabase()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('세션을 찾지 못했습니다')

  const result = await requestTossLogin(token)

  if (result.mode === 'switched') {
    if (!result.tokenHash) throw new Error('세션 토큰을 받지 못했습니다')
    const { error } = await sb.auth.verifyOtp({ token_hash: result.tokenHash, type: 'magiclink' })
    if (error) throw error
    return
  }

  // 여기까지 왔으면 서버에서 연동은 이미 끝났다. 손에 든 토큰에 계정 정보가 아직
  // 반영되지 않아 새로 받아 두지만, 실패해도 연동을 되돌릴 수는 없다.
  // 실패로 처리하면 '연동하지 못했어요'가 뜨는데 실제로는 연동된 상태라 거짓말이 된다.
  // 화면은 곧 getUser()로 최신 계정을 다시 읽으므로(fetchSocialName) 그대로 두면 된다.
  const { error } = await sb.auth.refreshSession()
  if (error) console.error('토스 연동 후 토큰 갱신 실패', error)
}

export interface RedirectError {
  provider: SocialProvider | null
  // 이 소셜 계정이 이미 다른 계정에 물려 있다 = 기존 회원 → 로그인으로 불러오면 된다
  alreadyLinked: boolean
}

function parseRedirectError(
  query: URLSearchParams,
  hash: URLSearchParams,
  provider: SocialProvider | null,
): RedirectError | null {
  if (!query.get('error') && !hash.get('error')) return null
  const code = query.get('error_code') ?? hash.get('error_code') ?? ''
  const description = query.get('error_description') ?? hash.get('error_description') ?? ''
  return {
    provider,
    alreadyLinked: code === 'identity_already_exists' || /already/i.test(description),
  }
}

// 네이티브는 실패도 딥링크로 온다 — 화면이 읽어 갈 때까지 여기 들고 있는다
let deepLinkError: RedirectError | null = null

// OAuth가 실패로 돌아온 경우를 한 번만 읽는다. 웹은 주소창도 같이 정리한다
export function takeRedirectError(): RedirectError | null {
  const provider = sessionStorage.getItem(PENDING_KEY) as SocialProvider | null
  sessionStorage.removeItem(PENDING_KEY)

  if (isNative) {
    const failed = deepLinkError
    deepLinkError = null
    return failed
  }

  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const failed = parseRedirectError(query, hash, provider)
  if (failed) history.replaceState(null, '', location.pathname)
  return failed
}

// 커스텀 탭에서 돌아온 주소를 푼다. 성공이면 세션을 만들고, 실패면 웹과 같은 모양으로
// 남겨 둔다 — 화면 쪽은 takeRedirectError 한 벌로 두 플랫폼을 다 본다.
async function completeOAuth(url: string): Promise<boolean> {
  const parsed = new URL(url)
  const query = new URLSearchParams(parsed.search)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))

  const code = query.get('code')
  if (code) {
    const sb = await getSupabase()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) throw error
    return true
  }

  deepLinkError = parseRedirectError(
    query,
    hash,
    sessionStorage.getItem(PENDING_KEY) as SocialProvider | null,
  )
  return false
}

if (isNative) {
  void watchAuthTab({
    onCallback: (url) => {
      if (!url.startsWith(AUTH_CALLBACK)) return
      // 탭을 닫으면 browserFinished가 뒤따라 온다. 취소로 오인하지 않게 먼저 걷어낸다
      const waiting = pending
      pending = null
      void closeAuthTab()
      void completeOAuth(url).then(
        (ok) => waiting?.done(ok),
        (reason) => waiting?.fail(reason),
      )
    },
    onClosed: () => {
      // 콜백 없이 닫혔다 = 로그인 창을 그냥 닫고 나왔다. 실패가 아니므로 조용히 되돌린다
      const waiting = pending
      pending = null
      waiting?.done(false)
    },
  })
}

// 연동된 소셜 계정의 표시 이름 (닉네임 자동 설정용). 서버에서 최신 identity도 함께 갱신한다
export async function fetchSocialName(): Promise<string | null> {
  const sb = await getSupabase()
  const { data } = await sb.auth.getUser()
  linkedProvider.value = readProvider(data.user)
  if (!data.user || !linkedProvider.value) return null
  const meta = data.user.user_metadata ?? {}
  const raw = meta.name ?? meta.full_name ?? meta.preferred_username ?? meta.user_name
  if (typeof raw !== 'string') return null
  const name = raw.trim().slice(0, 12)
  return name.length >= 1 ? name : null
}
