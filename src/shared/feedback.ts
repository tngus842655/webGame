import { ensureUserId } from './auth'
import type { TranslationKey } from './i18n'
import { getSupabase } from './supabase'

// 사용자 의견 — 보내는 쪽(/feedback)과 읽는 쪽(/admin/feedback)이 함께 쓴다.
// 답변 기능은 없다. 관리자가 읽기만 하므로 상태 값(읽음·처리됨)도 두지 않았다.

export type FeedbackKind = 'bug' | 'ask' | 'idea'

// 화면에 이 순서로 나란히 놓인다
export const FEEDBACK_KINDS: Array<{ kind: FeedbackKind; labelKey: TranslationKey }> = [
  { kind: 'bug', labelKey: 'fb.kindBug' },
  { kind: 'ask', labelKey: 'fb.kindAsk' },
  { kind: 'idea', labelKey: 'fb.kindIdea' },
]

// DB의 check 제약과 같은 값 — 넘치면 저장 단계에서 튕기므로 입력칸에서 먼저 막는다
export const TITLE_MAX = 40
export const BODY_MAX = 1000

export async function submitFeedback(
  kind: FeedbackKind,
  title: string,
  body: string,
): Promise<void> {
  const userId = await ensureUserId()
  const sb = await getSupabase()
  const { error } = await sb.from('feedback').insert({ user_id: userId, kind, title, body })
  if (error) throw error
}

export interface FeedbackItem {
  id: number
  kind: FeedbackKind
  title: string
  body: string
  createdAt: string
  nickname: string
}

// 한 화면에 다 실을 수 있는 양. 넘칠 만큼 쌓이면 그때 기간 탭을 붙인다
const LIST_LIMIT = 200

// 관리자만 통과한다 (RLS가 막는다)
export async function fetchFeedback(): Promise<FeedbackItem[]> {
  const sb = await getSupabase()
  const { data, error } = await sb
    .from('feedback')
    .select('id, kind, title, body, created_at, profiles (nickname)')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    kind: row.kind as FeedbackKind,
    title: row.title as string,
    body: row.body as string,
    createdAt: row.created_at as string,
    // 조인 결과는 PostgREST 버전에 따라 객체로도 배열로도 온다
    nickname: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.nickname ?? '',
  }))
}
