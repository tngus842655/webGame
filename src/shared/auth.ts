import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { getSupabase, whenSupabaseReady } from './supabase'

export type SocialProvider = 'google' | 'kakao'

// 연동 요청을 보낸 제공자 — OAuth 리다이렉트로 돌아왔을 때 어떤 버튼이었는지 알기 위해 남긴다
const PENDING_KEY = 'webgame:pendingProvider'

let cachedUserId: string | null = null

// 현재 계정에 연결된 소셜 제공자 (없으면 게스트) — 설정 화면과 허브 팝업이 함께 본다
export const linkedProvider = ref<SocialProvider | null>(null)

function readProvider(user: User | null | undefined): SocialProvider | null {
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

// 자동 로그인 없이 현재 세션만 조회 (랭킹에서 내 순위 강조용)
export async function getCurrentUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId
  const sb = await getSupabase()
  const { data } = await sb.auth.getSession()
  return data.session?.user.id ?? null
}

// 지금 쓰던 계정에 소셜 identity를 붙인다 — user_id가 그대로라 점수·랭킹이 유지된다
export async function linkSocial(provider: SocialProvider): Promise<void> {
  await ensureUserId()
  sessionStorage.setItem(PENDING_KEY, provider)
  const sb = await getSupabase()
  const { error } = await sb.auth.linkIdentity({
    provider,
    options: { redirectTo: `${location.origin}/settings` },
  })
  if (error) {
    sessionStorage.removeItem(PENDING_KEY)
    throw error
  }
}

// 이미 다른 기기에서 연동해둔 계정으로 로그인 — 그 계정의 기록을 그대로 이어받는다
export async function signInSocial(provider: SocialProvider): Promise<void> {
  sessionStorage.removeItem(PENDING_KEY)
  const sb = await getSupabase()
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${location.origin}/settings` },
  })
  if (error) throw error
}

export interface RedirectError {
  provider: SocialProvider | null
  // 이 소셜 계정이 이미 다른 계정에 물려 있다 = 기존 회원 → 로그인으로 불러오면 된다
  alreadyLinked: boolean
}

// OAuth 리다이렉트가 실패로 돌아온 경우를 한 번만 읽고 주소창을 정리한다
export function takeRedirectError(): RedirectError | null {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const provider = sessionStorage.getItem(PENDING_KEY) as SocialProvider | null
  sessionStorage.removeItem(PENDING_KEY)

  if (!query.get('error') && !hash.get('error')) return null
  const code = query.get('error_code') ?? hash.get('error_code') ?? ''
  const description = query.get('error_description') ?? hash.get('error_description') ?? ''
  history.replaceState(null, '', location.pathname)
  return {
    provider,
    alreadyLinked: code === 'identity_already_exists' || /already/i.test(description),
  }
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
