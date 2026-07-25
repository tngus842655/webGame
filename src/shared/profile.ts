import { ensureUserId } from './auth'
import { supabase } from './supabase'

export async function fetchMyNickname(): Promise<string> {
  const id = await ensureUserId()
  const { data, error } = await supabase.from('profiles').select('nickname').eq('id', id).single()
  if (error) throw error
  return data.nickname as string
}

export async function updateMyNickname(nickname: string): Promise<void> {
  const id = await ensureUserId()
  const { error } = await supabase.from('profiles').update({ nickname }).eq('id', id)
  if (error) throw error
}
