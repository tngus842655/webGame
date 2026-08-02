import { ref } from 'vue'
import { ensureUserId } from './auth'
import { t } from './i18n'
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

// 통계 화면과 이용자별 상세가 같은 기간을 본다 — 상세로 들어갔다 나와도 고른 탭이 그대로다
export const STATS_PERIODS = [1, 7, 30] as const
export const statsDays = ref<number>(7)

// 초 → "1시간 23분" / "12분 30초" / "45초"
export function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}${t('stats.hour')} ${m}${t('stats.minute')}`
  if (m > 0) return `${m}${t('stats.minute')} ${s}${t('stats.second')}`
  return `${s}${t('stats.second')}`
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

export interface PlayerGameStat {
  slug: string
  seconds: number
}

export interface PlayerStat {
  userId: string
  nickname: string
  seconds: number
  lastPlayedAt: string
  // 오래 한 게임부터 (서버가 정한 순서)
  games: PlayerGameStat[]
}

// get_player_stats()가 자르는 인원과 같은 값 — 잘린 사실을 화면에 알리는 데 쓴다
export const PLAYER_LIMIT = 100

// 함수는 구간 수(plays)도 돌려주지만 화면이 쓰지 않아 받지 않는다
interface PlayerStatRow {
  user_id: string
  nickname: string
  game_slug: string
  total_seconds: number
  last_played_at: string
}

// 관리자만 통과한다 (get_player_stats()의 첫 줄이 막는다)
export async function fetchPlayerStats(days: number): Promise<PlayerStat[]> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('get_player_stats', { p_days: days })
  if (error) throw error
  // (이용자, 게임) 한 쌍이 한 줄로 온다 — 사람 단위로 묶는다.
  // 순서는 서버가 정한 대로 두고 여기서 다시 정렬하지 않는다.
  const byUser = new Map<string, PlayerStat>()
  for (const row of (data ?? []) as PlayerStatRow[]) {
    let player = byUser.get(row.user_id)
    if (!player) {
      player = {
        userId: row.user_id,
        nickname: row.nickname,
        seconds: 0,
        lastPlayedAt: row.last_played_at,
        games: [],
      }
      byUser.set(row.user_id, player)
    }
    player.seconds += Number(row.total_seconds)
    // 게임 순서가 시간순이 아니므로 마지막 플레이는 줄마다 견줘서 고른다
    if (Date.parse(row.last_played_at) > Date.parse(player.lastPlayedAt)) {
      player.lastPlayedAt = row.last_played_at
    }
    player.games.push({ slug: row.game_slug, seconds: Number(row.total_seconds) })
  }
  return [...byUser.values()]
}
