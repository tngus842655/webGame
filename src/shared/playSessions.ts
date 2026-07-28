import { ensureUserId } from './auth'
import { getSupabase } from './supabase'

// 플레이 시간 기록 — 인기 순위와 통계의 근거 데이터
// 게임 코드는 건드리지 않고 플레이 화면 진입~이탈 시점만으로 측정한다.

const MIN_SECONDS = 5 // 잘못 눌러 들어온 경우 제외
const MAX_SECONDS = 1800 // 켜두고 방치한 경우 상한 (DB 제약과 동일)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface Credentials {
  userId: string
  accessToken: string
}

// 탭이 닫히는 순간에는 비동기로 토큰을 못 가져오므로 미리 확보해둔다
async function loadCredentials(): Promise<Credentials | null> {
  try {
    const userId = await ensureUserId()
    const sb = await getSupabase()
    const { data } = await sb.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return null
    return { userId, accessToken }
  } catch {
    return null
  }
}

// keepalive 요청이라 페이지가 닫혀도 전송이 완료된다
function send(creds: Credentials, slug: string, seconds: number) {
  const duration = Math.floor(Math.min(MAX_SECONDS, seconds))
  if (duration < MIN_SECONDS) return
  void fetch(`${SUPABASE_URL}/rest/v1/play_sessions`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${creds.accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: creds.userId,
      game_slug: slug,
      duration_sec: duration,
    }),
  }).catch(() => {
    // 통계용 데이터라 실패해도 게임 진행에는 영향을 주지 않는다
  })
}

/**
 * 플레이 시간 측정을 시작한다. 반환된 함수를 호출하면 측정이 끝나고 기록된다.
 * 앱을 백그라운드로 보내거나 탭을 닫아도 그 시점까지의 시간이 기록된다.
 */
export function startPlayTracking(slug: string): () => void {
  let creds: Credentials | null = null
  void loadCredentials().then((c) => {
    creds = c
  })

  let startedAt = performance.now()
  let stopped = false

  const flush = () => {
    if (startedAt === 0) return
    const seconds = (performance.now() - startedAt) / 1000
    startedAt = 0
    if (creds) send(creds, slug, seconds)
  }

  const onVisibility = () => {
    if (stopped) return
    if (document.hidden) flush()
    else startedAt = performance.now() // 돌아오면 새로 측정
  }
  const onPageHide = () => {
    if (!stopped) flush()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  return () => {
    if (stopped) return
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    flush()
  }
}

export interface GameStat {
  game_slug: string
  plays: number
  total_seconds: number
  avg_seconds: number
  players: number
  best_score: number
}

// 구간 전체의 이용자 수 — 게임별 인원은 서로 겹쳐서 더하거나 최댓값을 쓸 수 없다
export async function fetchTotalPlayers(days: number): Promise<number> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_total_players', { p_days: days })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchGameStats(days: number): Promise<GameStat[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_game_stats', { p_days: days })
  if (error) throw error
  return (data ?? []).map((row: GameStat) => ({
    ...row,
    plays: Number(row.plays),
    total_seconds: Number(row.total_seconds),
    avg_seconds: Number(row.avg_seconds),
    players: Number(row.players),
    best_score: Number(row.best_score),
  }))
}
