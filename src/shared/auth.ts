import { supabase } from './supabase'

let cachedUserId: string | null = null

// 세션이 없으면 익명 로그인으로 부트스트랩 (DESIGN.md 6장 인증 흐름)
export async function ensureUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId
  const { data } = await supabase.auth.getSession()
  let session = data.session
  if (!session) {
    const { data: anon, error } = await supabase.auth.signInAnonymously()
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
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}
