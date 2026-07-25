import { ensureUserId, fetchSocialName } from './auth'
import { supabase } from './supabase'

export interface MyProfile {
  nickname: string
  // 유저가 직접 정한 닉네임인지 — false면 소셜 연동 시 소셜 닉네임으로 덮어쓴다
  nicknameSet: boolean
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const id = await ensureUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, nickname_set')
    .eq('id', id)
    .single()
  if (error) throw error
  return { nickname: data.nickname as string, nicknameSet: data.nickname_set as boolean }
}

export async function updateMyNickname(nickname: string): Promise<void> {
  const id = await ensureUserId()
  const { error } = await supabase
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
