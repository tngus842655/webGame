import { ref } from 'vue'
import { getCurrentUserId } from './auth'
import { cacheGameFlags } from './scores'
import { getSupabase } from './supabase'

// 관리자 판별은 DB의 admin_emails 표에 등록된 이메일로만 이루어진다.
// 여기서 하는 일은 "관리자 메뉴를 보여줄지" 정하는 것뿐이고, 실제 권한은
// RLS 정책과 get_game_stats()의 검사로 막는다 — 화면을 숨기는 것만으로는
// API 직접 호출을 못 막기 때문이다.
export const isAdmin = ref(false)

let checked = false

export async function refreshAdmin(): Promise<boolean> {
  // 세션이 복원되기 전에 물으면 익명 키로 나가 무조건 false가 된다.
  // 세션이 아예 없으면(아직 계정이 만들어지기 전) 물어볼 것도 없다 — 관리자는 소셜 로그인 계정이다.
  if (!(await getCurrentUserId().catch(() => null))) {
    isAdmin.value = false
    return false
  }
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('is_admin')
  isAdmin.value = !error && data === true
  checked = true
  return isAdmin.value
}

// 라우트 가드처럼 결과가 필요한 곳에서 쓴다 (한 번 확인했으면 다시 묻지 않는다)
export async function ensureAdminChecked(): Promise<boolean> {
  if (checked) return isAdmin.value
  return refreshAdmin()
}

// 인기 상위 몇 개를 남길지 — 이 밖으로 밀린 게임이 휴지통 후보다
export const TOP_KEEP = 30

// 홈 '신규' 칸이 한 줄(카드 3개)이라 그 이상은 고정해도 자리가 없다
export const FEATURED_MAX = 3

// 휴지통 보관 기간. 이 기간이 지나면 코드에서 제거해도 되는 것으로 본다.
// 자동으로 지우지는 않는다 — 실제 삭제는 레지스트리와 폴더를 지우는 커밋이라 사람이 한다.
export const RETENTION_DAYS = 30

// 보관 기간이 며칠 남았는지 (0이면 지금 제거해도 된다)
export function daysLeft(trashedAt: string): number {
  const elapsed = (Date.now() - new Date(trashedAt).getTime()) / 86_400_000
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed))
}

export interface GameFlag {
  slug: string
  featured: boolean
  hidden: boolean
  sortOrder: number
  // 휴지통에 넣은 시각 (null이면 정상)
  trashedAt: string | null
}

export async function fetchGameFlags(): Promise<GameFlag[]> {
  const sb = await getSupabase()
  const { data, error } = await sb
    .from('game_flags')
    .select('slug, featured, hidden, sort_order, trashed_at')
  if (error) throw error
  const flags = (data ?? []).map((row) => ({
    slug: row.slug as string,
    featured: row.featured as boolean,
    hidden: row.hidden as boolean,
    sortOrder: Number(row.sort_order),
    trashedAt: (row.trashed_at as string | null) ?? null,
  }))
  // 홈 정렬이 서버 응답을 기다리지 않도록 캐시해 둔다
  cacheGameFlags(
    flags.map((f) => [
      f.slug,
      { featured: f.featured, hidden: f.hidden, sortOrder: f.sortOrder, trashed: !!f.trashedAt },
    ]),
  )
  return flags
}

// 관리자만 통과한다 (RLS가 막는다)
export async function saveGameFlag(flag: GameFlag): Promise<void> {
  const sb = await getSupabase()
  const { error } = await sb.from('game_flags').upsert({
    slug: flag.slug,
    featured: flag.featured,
    hidden: flag.hidden,
    sort_order: flag.sortOrder,
    trashed_at: flag.trashedAt,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
