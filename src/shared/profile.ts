import { ensureUserId, fetchSocialName, resetSession } from './auth'
import { getSupabase } from './supabase'

export interface MyProfile {
  nickname: string
  // 유저가 직접 정한 닉네임인지 — false면 소셜 연동 시 소셜 닉네임으로 덮어쓴다
  nicknameSet: boolean
}

async function selectProfile(id: string): Promise<MyProfile | null> {
  const sb = await getSupabase()
  // single()이 아니라 maybeSingle() — '행이 없다'와 '조회에 실패했다'를 갈라야 한다.
  // 통신 오류는 여기서 throw되고, 행이 없을 때만 null이 나온다.
  const { data, error } = await sb
    .from('profiles')
    .select('nickname, nickname_set')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { nickname: data.nickname as string, nicknameSet: data.nickname_set as boolean }
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const found = await selectProfile(await ensureUserId())
  if (found) return found
  // 내 행이 없다 = 계정이 사라졌다. profiles는 조회가 전체 공개라 RLS에 가려질 일이
  // 없으니 다른 해석의 여지가 없다 (대시보드에서 계정을 지웠거나, 탈퇴가 세션 정리
  // 직전에 끊겼거나). 세션을 새로 만들지 않으면 토큰이 만료될 때까지 화면이 잠긴다.
  const fresh = await selectProfile(await resetSession())
  if (!fresh) throw new Error('프로필을 만들지 못했습니다')
  return fresh
}

export async function updateMyNickname(nickname: string): Promise<void> {
  const id = await ensureUserId()
  const sb = await getSupabase()
  const { error } = await sb
    .from('profiles')
    .update({ nickname, nickname_set: true })
    .eq('id', id)
  if (error) throw error
}

// 연동 직후, 아직 닉네임을 직접 정하지 않았다면 소셜 닉네임을 그대로 쓴다
export async function adoptSocialNickname(profile: MyProfile): Promise<string | null> {
  if (profile.nicknameSet) return null
  const name = await fetchSocialName()
  if (!name) return null
  await updateMyNickname(name)
  return name
}
